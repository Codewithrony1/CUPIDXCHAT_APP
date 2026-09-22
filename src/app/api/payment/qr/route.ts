import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_MERCHANT_UPI_ID = 'sumitpornsware@fam';
const LEGACY_MERCHANT_UPI_ID = 'cupidxchat@upi';

export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany({
      where: {
        key: {
          in: [
            'paymentQrUrlIndia',
            'paymentQrUrlIndiaWeekly',
            'paymentQrUrlIndiaMonthly',
            'paymentQrUrlIndiaYearly',
            'paymentQrUrlIndiaThreeMonths',
            'paymentQrUrlInternational',
            'merchantUpiId',
            'merchantName',
            'indiaPriceWeekly',
            'indiaPriceMonthly',
            'indiaPriceYearly',
            'intlPriceMonthly',
            'intlPriceYearly',
          ],
        },
      },
    });

    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    const paymentQrUrlIndia = settingsMap.get('paymentQrUrlIndia') || '/uploads/qr/29.jpeg';
    const paymentQrUrlIndiaWeekly = settingsMap.get('paymentQrUrlIndiaWeekly') || paymentQrUrlIndia;
    const paymentQrUrlIndiaMonthly = settingsMap.get('paymentQrUrlIndiaMonthly') || paymentQrUrlIndia;
    const paymentQrUrlIndiaThreeMonths = settingsMap.get('paymentQrUrlIndiaThreeMonths') || '/uploads/qr/99qr.jpeg';
    const paymentQrUrlIndiaYearly = settingsMap.get('paymentQrUrlIndiaYearly') || '/uploads/qr/399qr.jpeg';
    const paymentQrUrlInternational = settingsMap.get('paymentQrUrlInternational') || '/lexino-qr.jpg';
    const storedMerchantUpiId = settingsMap.get('merchantUpiId');
    const merchantUpiId = storedMerchantUpiId && storedMerchantUpiId !== LEGACY_MERCHANT_UPI_ID
      ? storedMerchantUpiId
      : (process.env.MERCHANT_UPI_ID || DEFAULT_MERCHANT_UPI_ID);

    // Migrate the legacy UPI ID once so future requests and the admin UI use the new account.
    if (!storedMerchantUpiId || storedMerchantUpiId === LEGACY_MERCHANT_UPI_ID) {
      await prisma.appSetting.upsert({
        where: { key: 'merchantUpiId' },
        update: { value: merchantUpiId },
        create: { key: 'merchantUpiId', value: merchantUpiId },
      });
    }
    const merchantName = settingsMap.get('merchantName') || 'CupidX Chat';

    const indiaPriceMonthly = parseFloat(settingsMap.get('indiaPriceMonthly') || '29');
    const indiaPriceThreeMonths = parseFloat(settingsMap.get('indiaPriceThreeMonths') || '99');
    const indiaPriceYearly = parseFloat(settingsMap.get('indiaPriceYearly') || '399');
    const intlPriceMonthly = parseFloat(settingsMap.get('intlPriceMonthly') || '2');
    const intlPriceYearly = parseFloat(settingsMap.get('intlPriceYearly') || '12');

    // Dynamic UPI links (for tap-to-pay on mobile or generating QR codes)
    const buildUpiUri = (amount: number, plan: string) =>
      `upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(merchantName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('CupidX VIP ' + plan)}`;

    return NextResponse.json({
      success: true,
      paymentQrUrlIndia,
      paymentQrUrlIndiaMonthly,
      paymentQrUrlIndiaYearly,
      paymentQrUrlInternational,
      merchantUpiId,
      merchantName,
      pricing: {
        india: {
          currency: 'INR',
          symbol: '₹',
          monthly: indiaPriceMonthly,
          threeMonths: indiaPriceThreeMonths,
          yearly: indiaPriceYearly,
          qrMonthly: paymentQrUrlIndiaMonthly,
          qrThreeMonths: paymentQrUrlIndiaThreeMonths,
          qrYearly: paymentQrUrlIndiaYearly,
          upiMonthly: buildUpiUri(indiaPriceMonthly, 'Monthly'),
          upiThreeMonths: buildUpiUri(indiaPriceThreeMonths, '3 Months'),
          upiYearly: buildUpiUri(indiaPriceYearly, 'Yearly'),
        },
        international: {
          currency: 'USD',
          symbol: '$',
          monthly: intlPriceMonthly,
          yearly: intlPriceYearly,
          qrMonthly: paymentQrUrlInternational,
          qrYearly: paymentQrUrlInternational,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching payment QR settings:', error);
    return NextResponse.json({
      success: true,
      paymentQrUrlIndia: '/uploads/qr/29.jpeg',
      paymentQrUrlIndiaMonthly: '/uploads/qr/29.jpeg',
      paymentQrUrlIndiaYearly: '/uploads/qr/399qr.jpeg',
      paymentQrUrlInternational: '/lexino-qr.jpg',
      merchantUpiId: DEFAULT_MERCHANT_UPI_ID,
      merchantName: 'CupidX Chat',
      pricing: {
        india: {
          currency: 'INR',
          symbol: '₹',
          monthly: 29,
          threeMonths: 99,
          yearly: 399,
          qrMonthly: '/uploads/qr/29.jpeg',
          qrThreeMonths: '/uploads/qr/99qr.jpeg',
          qrYearly: '/uploads/qr/399qr.jpeg',
        },
        international: {
          currency: 'USD',
          symbol: '$',
          monthly: 2,
          yearly: 12,
          qrMonthly: '/lexino-qr.jpg',
          qrYearly: '/lexino-qr.jpg',
        },
      },
    });
  }
}
