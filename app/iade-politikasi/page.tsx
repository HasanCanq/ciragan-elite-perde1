import LegalPageLayout from "@/components/LegalPageLayout";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İptal & İade Politikası | Çırağan Elite Perde",
  description:
    "Siparişinizi iptal etmek veya revizyon/iade işlemi başlatmak için adım adım rehber. Özel ölçülü ürünlerde iade koşulları ve prosedürlerimiz.",
};

export default function IadePolitikasiPage() {
  return (
    <LegalPageLayout
      title="İptal & İade Politikası"
      description="Sipariş, iptal, kalite kontrol ve müşteri memnuniyeti kapsamındaki revizyon politikalarımız."
      lastUpdated="1 Ocak 2025"
      sections={[
        {
          heading: "Sipariş İptali",
          content: (
            <>
              <p>
                Siparişiniz <strong>üretim aşamasına geçmeden önce</strong> iptal edilebilir.
                İptal talebi için info@ciraganelite.com adresine sipariş numaranızı belirterek
                e-posta gönderin ya da 0553 046 4659 numaralı WhatsApp hattımızdan bize ulaşın.
              </p>
              <p>
                Sipariş üretilmeye başlandıktan sonra iptal mümkün değildir; bu durumda
                aşağıdaki özel ölçü politikası geçerlidir.
              </p>
            </>
          ),
        },
        {
          heading: "Cayma Hakkının İstisnaları — Ölçüye Özel Üretim",
          content: (
            <>
              <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
                <p className="font-semibold mb-2">Cayma hakkı kullanılamayan durumlar:</p>
                <p>
                  6502 sayılı Kanun Madde 15/1-b uyarınca,{" "}
                  <strong>
                    tüketicinin istekleri veya kişisel ihtiyaçları doğrultusunda özel olarak hazırlanan ürünler
                  </strong>{" "}
                  (ölçüye göre kesilen ve dikilen perdeler) cayma hakkı kapsamı dışındadır.
                </p>
              </div>
              <p className="mt-3">
                Siparişiniz üzerine, tamamen sizin belirttiğiniz ölçüler ve kişisel tercihleriniz doğrultusunda özel olarak üretilen ürünlerimiz yeniden satılabilirliğini kaybettiği için, üretimsel bir kusur olmadığı sürece cayma hakkı kapsamında iade veya değişim yapılamamaktadır.
              </p>
            </>
          ),
        },
        {
          heading: "Kalite Kontrol (QC) ve Kumaş Hataları",
          content: (
            <>
              <p>
                Tüm ürünlerimiz paketlenme aşamasından önce detaylı bir Kalite Kontrol (QC) sürecinden geçer ve kamera/fotoğraf kaydı ile belgelenerek <strong>&quot;Kalite Kontrol Onaylı&quot;</strong> barkodu ile kargolanır.
              </p>
              <p className="mt-3">
                Ürününüzü teslim aldığınızda tespit ettiğiniz üretim veya kumaş dokuma hataları için teslimat gününden itibaren <strong>24 saat içinde</strong> bizimle iletişime geçmeniz gerekmektedir. Kullanıcı hatası kaynaklı (kesici alet hasarı, yanlış yıkama, montaj sırasındaki yıpranmalar) kasıtlı veya kasıtsız deformasyonlar inceleme ekibimiz tarafından tespit edildiğinde iade talebi kesinlikle reddedilecektir.
              </p>
            </>
          ),
        },
        {
          heading: "Müşteri Memnuniyeti ve Revizyon Esnekliği",
          content: (
            <>
              <p>
                Markamız için müşteri memnuniyeti önceliğimizdir. Cayma hakkı kapsamı dışında kalan özel üretim ürünlerinizde yaşadığınız olası montaj veya ölçü hataları (kullanıcı kaynaklı dahi olsa) durumunda, markamızın çözüm merkezine ulaşabilirsiniz.
              </p>
              <p className="mt-3">
                Teknik ekibimiz, ürünün yapısı izin verdiği ölçüde (daraltma, boy kısaltma vb.) revizyon işlemleri için size destek sağlamak adına inisiyatif kullanabilir. Kusurlu ürün iadelerinde kargo masrafları tarafımıza aittir; ancak markamızın onayıyla kabul edilen istisnai revizyon veya değişim durumlarında <strong>gidiş-dönüş kargo bedelleri Alıcı&apos;ya aittir.</strong>
              </p>
            </>
          ),
        },
        {
          heading: "İade ve Revizyon Prosedürü",
          content: (
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                info@ciraganelite.com adresine veya WhatsApp hattımıza sipariş numaranız, talebinizin detayı ve ürün görselleriyle birlikte ulaşın.
              </li>
              <li>
                Ekibimiz 1–2 iş günü içinde talebinizi inceler (kamera kayıtları ve kalite kontrol barkodlarıyla karşılaştırılır) ve uygun bulunması halinde kargo gönderim sürecini size iletir.
              </li>
              <li>
                Ürünü orijinal ambalajında, güvenli şekilde paketleyerek belirtilen adrese gönderin.
              </li>
              <li>
                Ürün depomuzda incelendikten sonra revizyon işleminiz başlatılır veya üretim hatası onaylanan ürünler için ödemeniz orijinal ödeme yöntemiyle iade edilir.
              </li>
            </ol>
          ),
        },
        {
          heading: "Para İadesi",
          content: (
            <p>
              Onaylanan üretim hatası kaynaklı iadeler için ödeme; kredi/banka kartı işlemlerinde 5–10 iş günü içinde
              kartınıza, havale/EFT işlemlerinde ise 3–5 iş günü içinde IBAN&apos;ınıza aktarılır.
              Banka işlem süreleri bankadan bankaya farklılık gösterebilir.
            </p>
          ),
        },
      ]}
    />
  );
}