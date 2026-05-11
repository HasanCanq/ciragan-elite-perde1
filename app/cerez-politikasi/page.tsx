import LegalPageLayout from "@/components/LegalPageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Çerez Politikası | Hanedan",
  description:
    "Web sitemizde kullanılan çerezler, amaçları ve yönetim seçenekleri hakkında bilgi.",
};

export default function CerezPolitikasiPage() {
  return (
    <LegalPageLayout
      title="Çerez Politikası"
      description="Web sitemizin çalışması için kullandığımız çerezler, bunların amaçları ve tercihlerinizi nasıl yönetebileceğiniz hakkında şeffaf bilgi sunuyoruz."
      lastUpdated="29 Nisan 2026"
      sections={[
        {
          heading: "1. Çerez Nedir?",
          content: (
            <p>
              Çerezler (Cookies), web sitemizi ziyaret ettiğinizde tarayıcınız aracılığıyla
              cihazınıza depolanan küçük metin dosyalarıdır. Bu dosyalar, sitemizin düzgün
              çalışması, sepetinizin hatırlanması ve alışveriş deneyiminizin iyileştirilmesi
              amacıyla kullanılır.
            </p>
          ),
        },
        {
          heading: "2. Kullandığımız Çerez Türleri",
          content: (
            <>
              <p className="mb-4">
                Hanedan platformunda, kullanıcı deneyimini güvenli ve kesintisiz kılmak için
                yalnızca amacı doğrultusunda gerekli olan çerezler kullanılmaktadır.
              </p>

              <h3 className="font-semibold text-lg mb-2 mt-4">Zorunlu Çerezler</h3>
              <p>
                Sitenin temel işlevlerini yerine getirmesi için mecburidir. Kullanıcı girişi
                yapılması, oturumun açık kalması, sepete eklenen ürünlerin ödeme aşamasına
                kadar muhafaza edilmesi gibi işlemler bu çerezler sayesinde gerçekleşir. Devre
                dışı bırakılamazlar ve kişisel veri saklamazlar.
              </p>
              <table className="w-full text-xs border-collapse mt-2 mb-4">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 p-2 text-left">Çerez</th>
                    <th className="border border-gray-200 p-2 text-left">Amaç</th>
                    <th className="border border-gray-200 p-2 text-left">Süre</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 p-2">sb-auth-token</td>
                    <td className="border border-gray-200 p-2">Kullanıcı oturumu yönetimi (Supabase Auth)</td>
                    <td className="border border-gray-200 p-2">Oturum</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-2">sb-refresh-token</td>
                    <td className="border border-gray-200 p-2">Oturum yenileme</td>
                    <td className="border border-gray-200 p-2">7 gün</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 p-2">cart-storage</td>
                    <td className="border border-gray-200 p-2">Sepet içeriğinin saklanması (localStorage)</td>
                    <td className="border border-gray-200 p-2">Kalıcı</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="font-semibold text-lg mb-2 mt-6">Performans ve İşlevsellik Çerezleri</h3>
              <p>
                Sitemizin performansını ölçmek, olası sistemsel hataları tespit etmek ve sayfa
                yüklenme hızlarını optimize etmek için kullanılan anonim çerezlerdir.
              </p>
              <table className="w-full text-xs border-collapse mt-2">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 p-2 text-left">Çerez / Araç</th>
                    <th className="border border-gray-200 p-2 text-left">Amaç</th>
                    <th className="border border-gray-200 p-2 text-left">Süre</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 p-2">Sentry</td>
                    <td className="border border-gray-200 p-2">Hata izleme ve performans ölçümü</td>
                    <td className="border border-gray-200 p-2">Oturum</td>
                  </tr>
                </tbody>
              </table>
            </>
          ),
        },
        {
          heading: "3. Üçüncü Taraf Çerezleri",
          content: (
            <p>
              Siparişinizi tamamlama aşamasında, güvenli tahsilat işlemi için ödeme altyapı
              sağlayıcımızın (örn. iyzico) dolandırıcılık önleme ve güvenlik amaçlı zorunlu
              çerezleri devreye girebilir. Sitemizde şu an için reklam veya pazarlama amaçlı
              (Google Analytics, Meta Pixel vb.) izleme çerezleri kullanılmamaktadır.
            </p>
          ),
        },
        {
          heading: "4. Çerez Tercihlerinizi Yönetme",
          content: (
            <>
              <p>
                Tarayıcı ayarlarınızı değiştirerek çerezlere ilişkin tercihlerinizi her zaman
                kişiselleştirebilir, mevcut çerezleri silebilir veya tüm çerezleri
                reddedebilirsiniz. Ancak zorunlu çerezleri engellemeniz durumunda sitemize üye
                girişi yapamayacağınızı ve sepet işlevlerini kullanamayacağınızı belirtmek isteriz.
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <strong>Chrome:</strong> Ayarlar → Gizlilik ve güvenlik → Çerezler
                </li>
                <li>
                  <strong>Safari:</strong> Tercihler → Gizlilik → Çerezleri Yönet
                </li>
                <li>
                  <strong>Firefox:</strong> Ayarlar → Gizlilik ve Güvenlik → Çerezler
                </li>
                <li>
                  <strong>Edge:</strong> Ayarlar → Çerezler ve site izinleri
                </li>
              </ul>
            </>
          ),
        },
      ]}
    />
  );
}