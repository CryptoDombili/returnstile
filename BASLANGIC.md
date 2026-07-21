# Returnstile — Başlangıç Rehberi

## Şu anda hazır olanlar

- Premium, mobil uyumlu ana sayfa tasarımı
- Etkinlik kartları ve detay penceresi
- MetaMask bağlantısı ve GIWA Sepolia ağını otomatik ekleme/geçiş
- Dojang Verified Address sorgusu
- Open ve Verified etkinlik modeli
- Return-to-Queue akıllı kontratı
- FIFO bekleme sırası ve süreli claim hakkı
- Pull-based refund
- Tek kullanımlık imzalı check-in
- Hardhat deploy scripti ve temel testler

## İlk çalıştırma

Windows Terminal veya PowerShell'de proje klasörüne gir:

```powershell
npm install
npm run dev
```

Tarayıcıda görünen yerel adresi aç.

## Güvenlik

- Ana cüzdanı kullanma.
- Deploy için yeni burner wallet kullan.
- Private key'i yalnızca `.env` dosyasına yaz.
- `.env` dosyasını GitHub'a yükleme.
- Returnstile hiçbir kullanıcıdan kimlik belgesi istemez veya saklamaz.

## Sonraki geliştirme sırası

1. GitHub reposu oluşturma ve ilk push
2. Vercel canlı frontend
3. GIWA Sepolia faucet
4. Kontrat compile/test
5. GIWA Sepolia deploy
6. Deploy adresini frontend'e bağlama
7. Organizer Studio
8. Gerçek QR üretme ve tarama
9. Korece arayüz
10. Demo videosu ve GASOK başvurusu
