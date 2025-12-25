# Penta-Entegra XML Servisi

Penta bayi sisteminin REST API'sinden ürünleri çekip, Entegra entegrasyon sistemi için XML formatında sunan Node.js servisi.

## Özellikler

- ✅ Penta REST API'den ürün verisi çekme
- ✅ Entegra uyumlu XML formatı oluşturma
- ✅ Otomatik sayfalama (tüm sayfaları çeker)
- ✅ Belirli aralıklarla otomatik güncelleme
- ✅ HTTP sunucusu ile XML serve etme
- ✅ Sabit URL ile her zaman güncel XML
- ✅ Birden fazla kategori desteği
- ✅ Tüm ayarlar `.env` dosyasından yönetim
- ✅ Debug modu (API yanıtlarını dosyaya kaydetme)

## Proje Yapısı

```
├── index.js              # Ana XML servis uygulaması
├── package.json          # Bağımlılıklar
├── .env.example          # Örnek ortam değişkenleri
├── .env                  # Ortam değişkenleri (oluşturulmalı)
└── brands-viewer/        # Marka listesi görüntüleme aracı
    ├── index.js
    ├── package.json
    └── .env.example
```

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

# Güncelleme Aralığı (dakika cinsinden)
UPDATE_INTERVAL_MINUTES=30

# Sunucu Ayarları
SERVER_PORT=3000

# API Request Parametreleri
FIELDS_KEY=all-fields          # all-fields, only-price, only-stock (opsiyonel)
PRODUCT_TYPE=1                  # 1=XML, 2=Lisans, 3=XML+Lisans (zorunlu)
STOCK=true                      # true veya false (opsiyonel)
CATEGORY=                       # Virgülle ayrılmış kategori kodları (opsiyonel)
BRAND=                          # Marka kodu (opsiyonel)
PRODUCT_ID=                     # Ürün ID (opsiyonel)
UPDATE_DATE=                    # Format: D.MM.YYYY (opsiyonel)
PAGE=                           # Sayfa numarası (opsiyonel)
PAGE_SIZE=                      # Sayfa boyutu (opsiyonel)

# Debug: API cevabını txt dosyasına kaydet
DEBUG_API=false
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
| `/` | GET | Servis ana sayfası (HTML) |
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

## XML Yapısı (Entegra Formatı)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Products>
  <Product>
    <UstGrup_Ad><![CDATA[Kategori Seviye 1]]></UstGrup_Ad>
    <AnaGrup_Ad><![CDATA[Kategori Seviye 2]]></AnaGrup_Ad>
    <AltGrup_Ad><![CDATA[Kategori Seviye 4]]></AltGrup_Ad>
    <Kod>URUN_KODU</Kod>
    <Ad><![CDATA[Ürün Adı]]></Ad>
    <UrunGrubu><![CDATA[Malzeme Grubu]]></UrunGrubu>
    <UrunGrubuKodu>MGK001</UrunGrubuKodu>
    <Doviz>USD</Doviz>
    <Fiyat_SKullanici>100.00</Fiyat_SKullanici>
    <Fiyat_Bayi>85.00</Fiyat_Bayi>
    <Fiyat_Ozel>80.00</Fiyat_Ozel>
    <Miktar>50</Miktar>
    <Marka>MRK001</Marka>
    <MarkaIsim><![CDATA[Marka Adı]]></MarkaIsim>
    <Vergi>20</Vergi>
    <UreticiBarkodNo>1234567890123</UreticiBarkodNo>
  </Product>
</Products>
```

### XML Alan Açıklamaları

| Alan | Açıklama |
|------|----------|
| `UstGrup_Ad` | Kategori Seviye 1 adı |
| `AnaGrup_Ad` | Kategori Seviye 2 adı |
| `AltGrup_Ad` | Kategori Seviye 4 adı |
| `Kod` | Ürün kodu (productID) |
| `Ad` | Ürün adı |
| `UrunGrubu` | Malzeme grubu değeri |
| `UrunGrubuKodu` | Malzeme grubu kodu |
| `Doviz` | Para birimi (USD, EUR, TRY vb.) |
| `Fiyat_SKullanici` | Son kullanıcı fiyatı |
| `Fiyat_Bayi` | Bayi fiyatı |
| `Fiyat_Ozel` | Özel fiyat |
| `Miktar` | Stok miktarı |
| `Marka` | Marka kodu |
| `MarkaIsim` | Marka adı |
| `Vergi` | KDV oranı |
| `UreticiBarkodNo` | EAN/Barkod numarası |

---

## Marka Listesi Görüntüleyici (brands-viewer)

Penta API'deki marka listesini web arayüzünde görüntülemek için ayrı bir yardımcı araç.

### Kurulum

```bash
cd brands-viewer
npm install
cp .env.example .env
# .env dosyasını düzenleyin
```

### Çalıştırma

```bash
npm start
```

### Endpoint'ler

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/` | GET | Marka listesi (HTML - arama özellikli) |
| `/api/brands` | GET | Marka listesi (JSON) |

---

## Notlar

- XML her zaman aynı URL'den sunulur, içerik otomatik güncellenir
- Güncelleme sırasında eski XML serve edilmeye devam eder
- API hatası durumunda son başarılı XML cache'de tutulur
- Birden fazla kategori virgülle ayrılarak belirtilebilir (her kategori için ayrı istek atılır)
- Sayfalama otomatik çalışır, tüm sayfalar çekilir
- `DEBUG_API=true` ile API yanıtları `debug-api-response.txt` dosyasına kaydedilir

## Bağımlılıklar

- **express** - HTTP sunucusu
- **axios** - HTTP istekleri
- **dotenv** - Ortam değişkenleri yönetimi
- **xmlbuilder2** - XML oluşturma

## Lisans

ISC
