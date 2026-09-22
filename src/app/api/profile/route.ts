import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, getOrCreateUserFromClerk } from '@/lib/auth';
import { isVipAvatar } from '@/lib/avatars';
import { validateDob } from '@/lib/validation/dob';
import { saveBase64Image, deleteStoredImage } from '@/lib/safeImageUpload';
import { isUserVip, DEFAULT_BIO } from '@/lib/vipAuth';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if mood is expired
  if (user.profile?.moodExpiresAt && new Date() > new Date(user.profile.moodExpiresAt)) {
    await prisma.profile.update({
      where: { userId: user.id },
      data: {
        mood: '',
        moodExpiresAt: null,
      },
    });
    if (user.profile) {
      user.profile.mood = '';
      user.profile.moodExpiresAt = null;
    }
  }

  // Calculate remaining name changes today (max 4 per day)
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastChangeStr = user.profile?.nameChangesDate
    ? new Date(user.profile.nameChangesDate).toISOString().slice(0, 10)
    : null;

  const currentDayCount = lastChangeStr === todayStr ? (user.profile?.nameChangesCount ?? 0) : 0;
  const remainingNameChanges = Math.max(0, 4 - currentDayCount);

  const isVIP = isUserVip(user);

  return NextResponse.json({
    profile: {
      ...user.profile,
      bio: user.profile?.bio || DEFAULT_BIO,
      nameChangesCount: currentDayCount,
      remainingNameChangesToday: remainingNameChanges,
      randomChatIntroSeen: user.profile?.randomChatIntroSeen ?? false,
    },
    subscription: user.subscription,
    membershipTier: isVIP ? 'VIP' : 'FREE',
    is_vip: isVIP,
  });
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isVIP = isUserVip(user);
    const {
      displayName,
      bio,
      showBio,
      dob,
      dateOfBirth,
      age,
      gender,
      preferredGender,
      personalityPreferences,
      mood,
      showMood,
      moodDuration,
      language,
      saveChatHistory,
      interests,
      themePreference,
      avatarType,
      avatarEmoji,
      avatarData,
      avatarUrlPreset,
      randomChatIntroSeen,
    } = body;

    // Handle "Don't show again" persistent flag update
    if (randomChatIntroSeen !== undefined && Object.keys(body).length <= 2) {
      const updated = await prisma.profile.update({
        where: { userId: user.id },
        data: { randomChatIntroSeen: Boolean(randomChatIntroSeen) },
      });
      return NextResponse.json({ success: true, profile: updated });
    }

    // ─── 1. PERMANENT LOCKS & FREE vs VIP LOCK ENFORCEMENT ──────────────────
    const isProfileLocked = Boolean(
      user.profileCompleted ||
      user.profileLocked ||
      user.genderDobLocked ||
      user.profile?.profileCompleted ||
      user.profile?.ageGenderConfirmed ||
      (user.dob && user.gender && user.gender !== 'unspecified')
    );
    const inputDob = dob || dateOfBirth;
    const existingDob = user.dob || user.profile?.dob;
    const existingGender = user.gender || user.profile?.gender;
    const existingBio = user.profile?.bio || '';
    const currentName = user.displayName || user.fullName || user.username;

    // A. Date of Birth: PERMANENTLY LOCKED for BOTH Free and VIP once set
    let validatedNewDob: { dob: Date; age: number } | null = null;
    if (inputDob) {
      if (existingDob) {
        const newDobValidation = validateDob(inputDob);
        const newDobDate = newDobValidation.dobString || new Date(inputDob).toISOString().slice(0, 10);
        const oldDobDate = new Date(existingDob).toISOString().slice(0, 10);
        if (newDobDate !== oldDobDate) {
          return NextResponse.json(
            {
              error: 'Date of birth is permanently locked to preserve age verification and safety standards.',
              isLocked: true,
            },
            { status: 403 }
          );
        }
      } else {
        const dobValidation = validateDob(inputDob);
        if (!dobValidation.valid) {
          return NextResponse.json(
            { error: dobValidation.error || 'Please enter a valid date of birth.' },
            { status: 400 }
          );
        }
        validatedNewDob = { dob: dobValidation.dob!, age: dobValidation.age! };
      }
    }

    // B. Free users cannot edit Full / Display Name once profile is set up
    if (displayName !== undefined && displayName.trim() !== currentName && isProfileLocked && !isVIP) {
      return NextResponse.json(
        {
          error: 'Your name is locked for Free members. Upgrade to CupidX VIP to edit your name.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    // C. Free users cannot edit Gender once profile is set up
    if (gender !== undefined && existingGender && existingGender !== 'unspecified' && isProfileLocked && !isVIP) {
      const cleanNewGender = gender.trim().toLowerCase();
      const cleanOldGender = existingGender.trim().toLowerCase();
      if (cleanNewGender !== cleanOldGender) {
        return NextResponse.json(
          {
            error: 'Gender is locked for Free members. Upgrade to CupidX VIP to change your gender.',
            isVipRequired: true,
          },
          { status: 403 }
        );
      }
    }

    // D. Free users cannot edit Avatar / Profile Picture once profile is set up
    const isChangingAvatar =
      (avatarEmoji !== undefined && avatarEmoji !== '' && avatarEmoji !== user.profile?.avatarEmoji) ||
      (avatarType !== undefined && avatarType !== (user.profile?.avatarType || 'EMOJI')) ||
      Boolean(avatarData);
    if (isChangingAvatar && isProfileLocked && !isVIP) {
      return NextResponse.json(
        {
          error: 'Avatar customization is locked for Free members. Upgrade to CupidX VIP to unlock custom photos and premium avatars.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    // E. Free users cannot edit Bio
    if (bio !== undefined && !isVIP) {
      return NextResponse.json(
        {
          error: 'Bio customization is an exclusive CupidX VIP feature. Upgrade to VIP to write a custom bio.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    // ─── 2. Display Name Change Limit for VIP: Max 4 per calendar day ─────────
    let cleanDisplayName: string | undefined = undefined;
    let nextNameChangesCount = user.profile?.nameChangesCount ?? 0;
    let nextNameChangesDate: Date | undefined = undefined;

    if (displayName !== undefined) {
      const trimmed = displayName.trim();

      if (trimmed.length < 2 || trimmed.length > 50) {
        return NextResponse.json(
          { error: 'Display name must be between 2 and 50 characters.' },
          { status: 400 }
        );
      }
      if (/<[^>]*>|script|javascript:/i.test(trimmed)) {
        return NextResponse.json(
          { error: 'Invalid characters in display name.' },
          { status: 400 }
        );
      }

      if (trimmed !== currentName) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const lastChangeStr = user.profile?.nameChangesDate
          ? new Date(user.profile.nameChangesDate).toISOString().slice(0, 10)
          : null;

        const countToday = lastChangeStr === todayStr ? (user.profile?.nameChangesCount ?? 0) : 0;

        if (countToday >= 4) {
          return NextResponse.json(
            {
              error: "You have reached today's name change limit (4/4). You can change your name again tomorrow.",
              limitReached: true,
              remaining: 0,
            },
            { status: 429 }
          );
        }

        cleanDisplayName = trimmed;
        nextNameChangesCount = countToday + 1;
        nextNameChangesDate = new Date();
      }
    }

    // Sanitize VIP fields
    const cleanBio = isVIP && bio !== undefined ? bio.trim().slice(0, 500) : undefined;
    const cleanGender = gender !== undefined ? gender.trim().toLowerCase() : undefined;
    const parsedDob = inputDob ? new Date(inputDob) : undefined;

    // Strict VIP checks for Discovery / Mood / Personality
    const isUpdatingVIPAvatarEmoji = avatarEmoji !== undefined && avatarEmoji !== '' && isVipAvatar(avatarEmoji);
    const isUpdatingVIPAvatarImage = (avatarData && avatarData.startsWith('data:image/')) || avatarType === 'IMAGE';
    const isUpdatingVIPPreferences = preferredGender !== undefined && preferredGender !== '' && preferredGender !== 'auto';
    const isUpdatingVIPMood = (mood !== undefined && mood !== '') || (moodDuration !== undefined && moodDuration !== '');
    const isUpdatingVIPPersonality = personalityPreferences !== undefined && personalityPreferences !== '';

    if ((isUpdatingVIPAvatarEmoji || isUpdatingVIPAvatarImage || isUpdatingVIPPreferences || isUpdatingVIPMood || isUpdatingVIPPersonality) && !isVIP) {
      return NextResponse.json(
        {
          error: 'Premium avatar collection, custom profile pictures, custom moods & targeted discovery preferences require CupidX VIP.',
          isVipRequired: true,
        },
        { status: 403 }
      );
    }

    let avatarUrl = avatarUrlPreset !== undefined ? avatarUrlPreset : undefined;

    if (isUpdatingVIPAvatarImage && isVIP && avatarData) {
      const previousAvatarUrl = user.profile?.avatarUrl || null;
      const uploadRes = await saveBase64Image(avatarData, 'uploads', user.username);
      if (uploadRes.success && uploadRes.url) {
        avatarUrl = uploadRes.url;
        // Remove the previous custom avatar after the new image is safely stored.
        if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
          await deleteStoredImage(previousAvatarUrl);
        }
      } else {
        return NextResponse.json(
          { error: uploadRes.error || 'Failed to process avatar image.' },
          { status: uploadRes.statusCode || 400 }
        );
      }
    }

    // Calculate mood expiration timestamp
    let moodExpiresAt: Date | null | undefined = undefined;
    if (isVIP) {
      if (moodDuration === '1hour') {
        moodExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      } else if (moodDuration === '24hours') {
        moodExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      } else if (moodDuration === 'never') {
        moodExpiresAt = null;
      }
    }

    // Update User record
    const userUpdateData: any = {};
    if (cleanDisplayName) {
      userUpdateData.displayName = cleanDisplayName;
      userUpdateData.fullName = cleanDisplayName;
    }
    if (cleanGender && ['male', 'female', 'non-binary', 'other', 'prefer_not_to_say'].includes(cleanGender)) {
      if (isVIP || !existingGender || existingGender === 'unspecified') {
        userUpdateData.gender = cleanGender;
      }
    }
    if (validatedNewDob && !existingDob) {
      userUpdateData.dob = validatedNewDob.dob;
      userUpdateData.genderDobLocked = true;
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      });
    }

    // Update Profile record
    const profileUpdateData: any = {
      bio: cleanBio !== undefined ? cleanBio : undefined,
      showBio: showBio !== undefined ? Boolean(showBio) : undefined,
      gender: cleanGender !== undefined ? (isVIP || !existingGender || existingGender === 'unspecified' ? cleanGender : undefined) : undefined,
      dob: validatedNewDob && !existingDob ? validatedNewDob.dob : undefined,
      age: validatedNewDob && !existingDob ? validatedNewDob.age : undefined,
      preferredGender: preferredGender !== undefined ? preferredGender : undefined,
      personalityPreferences: isVIP && personalityPreferences !== undefined ? personalityPreferences : undefined,
      mood: isVIP && mood !== undefined ? mood : undefined,
      showMood: showMood !== undefined ? Boolean(showMood) : undefined,
      moodExpiresAt: isVIP && moodExpiresAt !== undefined ? moodExpiresAt : undefined,
      language: language !== undefined ? language : undefined,
      saveChatHistory: saveChatHistory !== undefined ? Boolean(saveChatHistory) : undefined,
      interests: interests !== undefined ? interests : undefined,
      themePreference: themePreference !== undefined ? themePreference : undefined,
      avatarType: avatarType !== undefined ? avatarType : undefined,
      avatarEmoji: avatarEmoji !== undefined ? avatarEmoji : undefined,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
    };

    if (nextNameChangesDate) {
      profileUpdateData.nameChangesCount = nextNameChangesCount;
      profileUpdateData.nameChangesDate = nextNameChangesDate;
    }

    const updatedProfile = await prisma.profile.update({
      where: { userId: user.id },
      data: profileUpdateData,
    });

    const remainingNameChanges = Math.max(0, 4 - (updatedProfile.nameChangesCount ?? 0));

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        ...updatedProfile,
        remainingNameChangesToday: remainingNameChanges,
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
