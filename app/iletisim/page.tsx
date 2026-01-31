"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  
  User,
  MessageSquare,
  Loader2,
} from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  
  // 🚀 PERFORMANS HİLESİ: Harita sayfa açıldıktan sonra sessizce yüklenecek
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowMap(true), 1500); 
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");

    // Form gönderme simülasyonu
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setSubmitStatus("success");
    setIsSubmitting(false);
    setFormData({ name: "", email: "", message: "" });
  };

  return (
    <main className="min-h-screen bg-elite-bone">
      {/* Hero Section */}
      <section className="bg-elite-black py-16 lg:py-24">
        <div className="elite-container">
          <nav className="flex items-center gap-2 text-sm mb-6">
            <Link href="/" className="text-elite-bone/70 hover:text-elite-gold transition-colors">
              Ana Sayfa
            </Link>
            <ChevronRight className="w-4 h-4 text-elite-bone/50" />
            <span className="text-elite-gold">İletişim</span>
          </nav>

          <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-elite-bone">
            İletişim
          </h1>
          <p className="mt-4 text-elite-bone/80 text-lg max-w-2xl">
            Sorularınız için bize ulaşın. Uzman ekibimiz size yardımcı olmaktan mutluluk duyacaktır.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 lg:py-24">
        <div className="elite-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            
            {/* Sol Kolon - Bilgiler */}
            <div className="space-y-6">
              <span className="text-elite-gold font-medium tracking-wider uppercase text-sm">Bize Ulaşın</span>
              <h2 className="font-serif text-3xl font-semibold text-elite-black mt-3 mb-8">İletişim Bilgileri</h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4 p-5 bg-white rounded-xl shadow-elite">
                  <div className="w-12 h-12 bg-elite-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-elite-gold" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-elite-black mb-1">Adres</h3>
                    <p className="text-elite-gray leading-relaxed">
                      Atatürk, Estergon Cd. No:3, <br />
                      34000 Ümraniye/İstanbul
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 bg-white rounded-xl shadow-elite">
                  <div className="w-12 h-12 bg-elite-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-elite-gold" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-elite-black mb-1">Telefon</h3>
                  
                    <p className="text-elite-gray text-sm">0532 295 95 86 (WhatsApp)</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 bg-white rounded-xl shadow-elite">
                  <div className="w-12 h-12 bg-elite-gold/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-elite-gold" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-elite-black mb-1">Çalışma Saatleri</h3>
                    <p className="text-elite-gray text-sm">Pazartesi - Cumartesi: 09:00 - 19:00</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sağ Kolon - Harita ve Form */}
            <div className="space-y-8">
              <div>
                <h3 className="font-serif text-xl font-semibold text-elite-black mb-4">Konumumuz</h3>
                <div className="relative aspect-video rounded-2xl overflow-hidden shadow-elite bg-gray-100 border border-gray-200">
                  {showMap ? (
                    <iframe
                    
                      src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d188.11871436386778!2d29.090266416421414!3d41.027456164079!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1str!2str!4v1769783198287!5m2!1str!2str"
                      width="100%"
                      height="100%"
                      style={{ border: 0, filter: "grayscale(10%) contrast(1.1)" }}
                      allowFullScreen
                      loading="lazy"
                      title="Çırağan Elite Perde Ümraniye"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-elite-gray gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-elite-gold" />
                      <p className="text-sm">Harita hazırlanıyor...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Alanı */}
              <div className="bg-white rounded-2xl shadow-elite p-8">
                <h3 className="font-serif text-xl font-semibold text-elite-black mb-6">Mesaj Gönderin</h3>
                
                {submitStatus === "success" && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
                    Mesajınız başarıyla iletildi.
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-elite-gray" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Ad Soyad"
                      className="elite-input pl-10"
                      required
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-elite-gray" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="E-posta"
                      className="elite-input pl-10"
                      required
                    />
                  </div>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-elite-gray" />
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Mesajınız"
                      className="elite-input pl-10 min-h-[120px] pt-3"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full elite-button justify-center"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Gönder"}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}