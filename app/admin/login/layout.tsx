export const metadata = {
  title: 'Admin Girişi | Çırağan Elite Perde',
  description: 'Yönetim Paneli Girişi',
};

export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This layout returns children directly,
  // the parent admin layout will skip rendering sidebar for login page
  return <>{children}</>;
}
