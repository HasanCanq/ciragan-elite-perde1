import LegalPageLayout from "@/components/LegalPageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Hanedan",
  description:
    "Kişisel verilerinizi nasıl topladığımız, kullandığımız ve koruduğumuza dair gizlilik politikamız.",
};

export default function GizlilikPage() {
  return (
    <LegalPageLayout
      title="Gizlilik Politikası"
      description="Kişisel verilerinizin gizliliği bizim için önceliktir. Bu sayfa, hangi verileri topladığımızı ve nasıl koruduğumuzu açıklar."
      lastUpdated="29 Nisan 2026"
      sections={[
        {
          heading: "1. Genel Bakış",
          content: (
            <p>
              Hanedan olarak, kişisel verilerinizin güvenliğine ve gizliliğine en üst düzeyde önem
              veriyoruz. Müşterilerimizin kişisel verileri, 6698 sayılı Kişisel Verilerin Korunması
              Kanunu (KVKK) ve ilgili mevzuat çerçevesinde yalnızca size daha iyi hizmet sunabilmek
              amacıyla işlenmekte ve uluslararası güvenlik standartlarında korunmaktadır.
            </p>
          ),
        },
        {
          heading: "2. Topladığımız Veriler",
          content: (
            <>
              <p>Hizmetlerimizi kullanımınız sırasında şu veriler işlenebilmektedir:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <strong>Kimlik ve İletişim:</strong> Ad, soyad, e-posta adresi, telefon numarası.
                </li>
                <li>
                  <strong>Sipariş ve Teslimat:</strong> Fatura ve teslimat adresleri, sipariş geçmişi.
                </li>
                <li>
                  <strong>Ödeme Bilgileri:</strong> Tercih edilen ödeme yöntemi (Kredi/banka kartı
                  bilgileriniz sistemlerimizde asla saklanmaz; doğrudan BDDK lisanslı ödeme
                  kuruluşuna şifreli olarak iletilir).
                </li>
                <li>
                  <strong>Site Kullanım Verileri:</strong> IP adresi, tarayıcı bilgileri, sepet
                  içeriği ve gezinti hareketleri.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "3. Verileri Kullanma Amaçlarımız",
          content: (
            <>
              <p>Kişisel verileriniz, yasal sınırlar içerisinde kalarak şu amaçlarla kullanılmaktadır:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Siparişlerinizin alınması, özel üretimi ve güvenli teslimatının sağlanması,</li>
                <li>Üyelik, oturum ve sepet işlemlerinizin sorunsuz yürütülmesi,</li>
                <li>Fatura, muhasebe ve yasal kayıt yükümlülüklerinin yerine getirilmesi,</li>
                <li>Müşteri destek taleplerinizin hızla çözüme kavuşturulması,</li>
                <li>Sistem güvenliğinin sağlanması ve olası sahtecilik işlemlerinin önlenmesi.</li>
              </ul>
            </>
          ),
        },
        {
          heading: "4. Veri Güvenliği ve Paylaşımı",
          content: (
            <p>
              Verilerinizi korumak için güncel şifreleme teknolojileri ve katı erişim protokolleri
              uygulanmaktadır. Kişisel verileriniz hiçbir şekilde ticari amaçla satılmaz veya üçüncü
              partilerle paylaşılmaz. Sadece siparişin tamamlanabilmesi için zorunlu olan hizmet
              sağlayıcılarla (anlaşmalı lojistik şirketleri, güvenli ödeme altyapıları ve sunucu
              hizmeti alınan uluslararası standartlardaki teknoloji iş ortakları) hukuka uygun olarak
              paylaşılır.
            </p>
          ),
        },
        {
          heading: "5. Çocukların Gizliliği",
          content: (
            <p>
              Platformumuz 18 yaş altı bireylere yönelik hizmet sunmamaktadır. Bu yaş grubuna ait
              verilerin sistemimize girdiği tespit edildiğinde derhal imha edilir.
            </p>
          ),
        },
        {
          heading: "6. Haklarınız ve İletişim",
          content: (
            <p>
              KVKK Madde 11 kapsamındaki tüm haklarınız (bilgi alma, düzeltme, silme talep etme)
              hakkında detaylı bilgiye{" "}
              <a
                href="/kvkk"
                className="text-[#B89947] underline hover:no-underline"
              >
                &quot;KVKK Aydınlatma Metni&quot;
              </a>{" "}
              sayfamızdan ulaşabilir; taleplerinizi{" "}
              <a href="mailto:info@hanedan.com.tr" className="hover:underline">
                info@hanedan.com.tr
              </a>{" "}
              adresi üzerinden bize iletebilirsiniz.
            </p>
          ),
        },
      ]}
    />
  );
}