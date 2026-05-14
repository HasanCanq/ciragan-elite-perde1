import LegalPageLayout from "@/components/LegalPageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mesafeli Satış Sözleşmesi | Hanedan",
  description:
    "6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında hazırlanmış mesafeli satış sözleşmesi.",
};

export default function MesafeliSatisPage() {
  return (
    <LegalPageLayout
      title="Mesafeli Satış Sözleşmesi"
      description="6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca hazırlanmıştır."
      lastUpdated="1 Ocak 2025"
      sections={[
        {
          heading: "1. Taraflar",
          content: (
            <>
              <p>
                <strong>SATICI:</strong> Hanedan — Atatürk, Estergon Cd. No:3, 34000
                Ümraniye/İstanbul — Tel: 0553 046 4659 — E-posta: info@ciraganelite.com
              </p>
              <p>
                <strong>ALICI:</strong> Sipariş formunda belirtilen ad, soyad ve iletişim bilgilerine
                sahip tüketici.
              </p>
            </>
          ),
        },
        {
          heading: "2. Konu",
          content: (
            <p>
              İşbu sözleşme, Alıcı&apos;nın internet sitesi üzerinden elektronik
              ortamda sipariş ettiği ürün(ler)in teslimine ilişkin Satıcı ve Alıcı arasındaki hak ve
              yükümlülükleri 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler
              Yönetmeliği çerçevesinde düzenlemektedir.
            </p>
          ),
        },
        {
          heading: "3. Cayma Hakkı ve İstisnaları (Özel Ölçü)",
          content: (
            <>
              <p>
                Alıcı, Mesafeli Sözleşmeler Yönetmeliği&apos;nin 15. maddesinin 1. fıkrasının (b) bendi uyarınca; 
                <strong> &quot;Tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda hazırlanan mallar&quot; </strong> 
                kapsamında sipariş edilen özel ölçülü perde ve tekstil ürünlerinde <strong>CAYMA HAKKINA SAHİP DEĞİLDİR.</strong>
              </p>
              <p className="mt-2">
                Alıcı, kendi belirlediği ölçü, renk ve donanım özelliklerine göre spesifik olarak üretime alınan bu ürünlerin, yeniden satılabilirliğinin olmaması sebebiyle iadesinin veya keyfi değişiminin mümkün olmadığını sipariş anında peşinen kabul eder.
              </p>
            </>
          ),
        },
        {
          heading: "4. Kalite Kontrol (QC) ve Bildirim Yükümlülüğü",
          content: (
            <>
              <p>
                Tüm ürünler, Satıcı tesislerinde detaylı kalite kontrol sürecinden geçirilerek, kamera/fotoğraf kaydı ile belgelenip <strong>&quot;Kalite Kontrol Onaylı&quot;</strong> barkoduyla sevk edilmektedir. Olası hukuki uyuşmazlıklarda bu kayıtlar Satıcı tarafından kesin delil olarak sunulacaktır.
              </p>
              <p className="mt-2 font-semibold text-red-700">
                Teslim alınan üründe tespit edilen üretimsel ayıplar, teslimat tarihinden itibaren en geç 24 saat içerisinde Satıcı&apos;ya yazılı ve görsel olarak bildirilmek zorundadır.
              </p>
              <p className="mt-2">
                Alıcı&apos;nın kusurundan kaynaklanan (kesici alet hasarı, yanlış yıkama, hatalı montaj) deformasyonlar ayıp kapsamında değerlendirilmez ve iade/değişim talebi reddedilir.
              </p>
            </>
          ),
        },
        {
          heading: "5. Teslimat ve Hasar Tespiti",
          content: (
            <>
              <p>
                Ürünler, sipariş onayından itibaren 7–15 iş günü içinde Alıcı&apos;nın adresine teslim edilir. Alıcı, paket üzerinde hasar tespit etmesi halinde paketi teslim almamak ve kargo görevlisine <strong>&quot;Hasar Tespit Tutanağı&quot;</strong> tutturmakla yükümlüdür. Tutanak tutulmayan kargo hasarlarından Satıcı sorumlu tutulamaz.
              </p>
            </>
          ),
        },
        {
          heading: "6. Revizyon ve Müşteri Memnuniyeti İnisiytifi",
          content: (
            <>
              <p>
                Cayma hakkı dışında kalan özel üretim ürünlerde, Alıcı&apos;nın ölçü veya sipariş hatası durumunda Satıcı, teknik elverişliliğe göre (daraltma, boy kısaltma vb.) revizyon desteği sunabilir.
              </p>
              <p className="mt-2">
                Bu istisnai revizyon süreçlerinde <strong>gidiş-dönüş kargo bedelleri ve oluşabilecek ek işçilik maliyetleri tamamen Alıcı tarafından karşılanacaktır.</strong>
              </p>
            </>
          ),
        },
        {
          heading: "7. Uyuşmazlık Çözümü",
          content: (
            <p>
              Uyuşmazlıklarda, T.C. Ticaret Bakanlığı tarafından ilan edilen değere kadar Tüketici Hakem Heyetleri, bu değerin üzerindeki uyuşmazlıklarda ise Tüketici Mahkemeleri yetkilidir.
            </p>
          ),
        },
        {
          heading: "8. Yürürlük",
          content: (
            <p>
              Alıcı, site üzerinden verdiği siparişe ait ödemeyi gerçekleştirdiğinde işbu sözleşmenin tüm şartlarını kabul etmiş sayılır.
            </p>
          ),
        },
      ]}
    />
  );
}