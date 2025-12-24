# Penta-Entegra XML Servisi

Penta bayi sisteminin REST API'sinden ürünleri çekip, Entegra entegrasyon sistemi için XML formatında sunan Node.js servisi.

## Özellikler

- ✅ Penta REST API'den ürün verisi çekme
- ✅ Otomatik XML oluşturma
- ✅ Belirli aralıklarla otomatik güncelleme
- ✅ HTTP sunucusu ile XML serve etme
- ✅ Sabit URL ile her zaman güncel XML
- ✅ Tüm ayarlar `.env` dosyasından yönetim

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
npm install
```

### 2. Ortam Değişkenlerini Ayarla

`.env.example` dosyasını `.env` olarak kopyalayın ve değerleri doldurun:

```bash
cp .env.example .env
```

### 3. `.env` Dosyası Ayarları

```env
# Penta API Ayarları
PENTA_API_URL=https://api.penta.com.tr/api/products
PENTA_API_TOKEN=your_token_here

# Güncelleme Aralığı (dakika)
UPDATE_INTERVAL_MINUTES=30

# Sunucu Port
SERVER_PORT=3000

# API Parametreleri
FIELDS_KEY=all-fields          # all-fields, only-price, only-stock
PRODUCT_TYPE=1                  # 1=XML, 2=Lisans, 3=XML+Lisans
STOCK=true                      # true veya false
CATEGORY=13003007001,13003007002  # Virgülle ayrılmış kategori kodları
BRAND=                          # Marka kodu
PRODUCT_ID=                     # Ürün ID
UPDATE_DATE=                    # Format: D.MM.YYYY
PAGE=                           # Sayfa numarası
PAGE_SIZE=                      # Sayfa boyutu
```

## Çalıştırma

### Geliştirme
```bash
npm run dev
```

### Production
```bash
npm start
```

## Windows Server'da Servis Olarak Çalıştırma

### PM2 ile (Önerilen)

```bash
# PM2'yi global olarak yükle
npm install -g pm2

# Servisi başlat
pm2 start index.js --name "penta-xml"

# Windows başlangıcında otomatik çalışması için
pm2 startup
pm2 save
```

### NSSM ile (Windows Service)

1. [NSSM](https://nssm.cc/download) indirin
2. Komut satırında:
```cmd
nssm install PentaXmlService
```
3. Açılan pencerede:
   - **Path**: `C:\Program Files\nodejs\node.exe`
   - **Startup directory**: Proje klasörü
   - **Arguments**: `index.js`

## API Endpoint'leri

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/` | GET | Servis ana sayfası |
| `/products.xml` | GET | Ürün XML'i (Entegra için bu URL'i kullanın) |
| `/status` | GET | Servis durumu (JSON) |
| `/refresh` | POST | Manuel XML güncelleme |

## Entegra Entegrasyonu

Entegra'ya aşağıdaki URL'i tanımlayın:

```
http://localhost:3000/products.xml
```

veya sunucu IP'si ile:

```
http://SUNUCU_IP:3000/products.xml
```

## XML Yapısı

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Products generatedAt="2024-12-24T20:00:00.000Z" totalCount="150">
  <Product>
    <ProductId>210000655</ProductId>
    <ProductName>Örnek Ürün</ProductName>
    <Price>100.00</Price>
    <Stock>50</Stock>
    <Category>13003007001</Category>
    <Brand>MHM100</Brand>
    <!-- ... diğer alanlar API yanıtına göre ... -->
  </Product>
  <!-- ... diğer ürünler ... -->
</Products>
```

## Notlar

- XML her zaman aynı URL'den sunulur, içerik otomatik güncellenir
- Güncelleme sırasında eski XML serve edilmeye devam eder
- API hatası durumunda son başarılı XML cache'de tutulur
- Birden fazla kategori virgülle ayrılarak belirtilebilir

## Lisans

ISC
