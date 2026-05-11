import LegalPageLayout from "@/components/LegalPageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KVKK Aydınlatma Metni | Hanedan",
  description:
    "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) Madde 10 kapsamında kişisel verilerinizin işlenmesine ilişkin aydınlatma metni.",
};

export default function KvkkPage() {
  return (
    <LegalPageLayout
      title="KVKK Aydınlatma Metni"
      description="6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi gereğince kişisel verilerinizin işlenmesi hakkında bilgilendiriliyorsunuz."
      lastUpdated="1 Ocak 2025"
      sections={[
        {
          heading: "1. Veri Sorumlusu",
          content: (
            <p>
              Kişisel verileriniz; veri sorumlusu sıfatıyla{" "}
              <strong>Hanedan</strong> (Atatürk, Estergon Cd. No:3, 34000
              Ümraniye/İstanbul — info@hanedan.com.tr — 0532 295 95 86) tarafından,
              6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında işlenmektedir.
            </p>
          ),
        },
        {
          heading: "2. İşlenen Kişisel Verileriniz",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Kimlik Bilgileri:</strong> Ad, soyad
              </li>
              <li>
                <strong>İletişim Bilgileri:</strong> E-posta adresi, telefon numarası, teslimat ve fatura adresi
              </li>
              <li>
                <strong>Müşteri İşlem Bilgileri:</strong> Sipariş geçmişi, ürün konfigürasyon detayları, ödeme yöntemi bilgisi (kredi kartı bilgileriniz sunucularımızda kesinlikle saklanmaz).
              </li>
              <li>
                <strong>İşlem Güvenliği Bilgileri:</strong> IP adresi, oturum bilgileri, çerez (cookie) verileri.
              </li>
            </ul>
          ),
        },
        {
          heading: "3. Kişisel Verilerin İşlenme Amaçları",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>Özel ölçülü siparişlerinizin alınması, üretimi ve teslimat süreçlerinin yürütülmesi,</li>
              <li>Satış sözleşmesinden doğan yükümlülüklerimizin yerine getirilmesi,</li>
              <li>Fatura kesimi ve muhasebe işlemlerinin gerçekleştirilmesi,</li>
              <li>Satış sonrası destek ve müşteri hizmetleri faaliyetlerinin yürütülmesi,</li>
              <li>Web sitemizin güvenliğinin sağlanması ve olası dolandırıcılık faaliyetlerinin önlenmesi,</li>
              <li>Açık rızanızın bulunması hâlinde; size özel kampanya, indirim ve bülten iletilerinin gönderilmesi.</li>
            </ul>
          ),
        },
        {
          heading: "4. Hukuki İşleme Sebepleri",
          content: (
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Sözleşmenin Kurulması ve İfası (Md. 5/2-c):</strong> Sipariş ve teslimat süreçleri.
              </li>
              <li>
                <strong>Hukuki Yükümlülüklerin Yerine Getirilmesi (Md. 5/2-ç):</strong> Ticari ve mali kayıtların tutulması, e-fatura süreçleri.
              </li>
              <li>
                <strong>Meşru Menfaat (Md. 5/2-f):</strong> Sistem güvenliğinin sağlanması.
              </li>
              <li>
                <strong>Açık Rıza (Md. 5/1):</strong> Pazarlama ve tanıtım iletişimleri.
              </li>
            </ul>
          ),
        },
        {
          heading: "5. Kişisel Verilerin Aktarımı",
          content: (
            <>
              <p>Kişisel verileriniz, yalnızca belirtilen amaçların gerçekleştirilmesi için aşağıdaki alıcı gruplarıyla paylaşılabilir:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Lojistik İş Ortakları:</strong> Siparişlerinizin teslimatı için anlaşmalı kargo firmaları,
                </li>
                <li>
                  <strong>Ödeme Kuruluşları:</strong> Güvenli tahsilatın sağlanması amacıyla BDDK lisanslı ödeme altyapı sağlayıcıları (örn. iyzico),
                </li>
                <li>
                  <strong>Teknoloji Sağlayıcıları:</strong> Veri güvenliğini sağlamak amacıyla uluslararası standartlarda barındırma ve altyapı hizmeti aldığımız teknoloji firmaları,
                </li>
                <li>
                  <strong>Yetkili Kurumlar:</strong> Yasal zorunluluk hâlinde resmi kamu kurum ve kuruluşları.
                </li>
              </ul>
            </>
          ),
        },
        {
          heading: "6. Kişisel Verilerin Saklanma Süresi",
          content: (
            <p>
              İşlenen verileriniz, ilgili yasal mevzuatlarda (Türk Ticaret Kanunu, Vergi Usul Kanunu vb.) öngörülen saklama süreleri boyunca muhafaza edilir. Yasal sürelerin dolması veya işleme amacının ortadan kalkması hâlinde verileriniz periyodik imha politikamıza uygun olarak silinir, yok edilir veya anonim hâle getirilir.
            </p>
          ),
        },
        {
          heading: "7. İlgili Kişi Olarak Haklarınız (KVKK Madde 11)",
          content: (
            <>
              <p>
                KVKK&apos;nın 11. maddesi kapsamında aşağıdaki haklara sahipsiniz:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
                <li>Yurt içinde/dışında aktarıldığı üçüncü kişileri öğrenme</li>
                <li>Eksik/yanlış işlenmiş verilerin düzeltilmesini isteme</li>
                <li>Şartlar çerçevesinde silinmesini veya yok edilmesini isteme</li>
                <li>Otomatik sistemlerle analiz nedeniyle aleyhinize bir sonuç doğmasına itiraz etme</li>
                <li>Kanuna aykırı işleme nedeniyle zararın giderilmesini talep etme</li>
              </ul>
              <p className="mt-3">
                Haklarınızı kullanmak için taleplerinizi <strong>info@hanedan.com.tr</strong> adresine güvenli elektronik imza ile veya kimliğinizi doğrulayan yazılı bir dilekçe ile iletebilirsiniz. Başvurunuz en geç 30 gün içinde yanıtlanacaktır.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}