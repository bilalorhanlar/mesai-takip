import StaffApp from '@/components/StaffApp';

export const viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', themeColor: '#ffffff',
};

export default function Page() {
  return <StaffApp />;
}
