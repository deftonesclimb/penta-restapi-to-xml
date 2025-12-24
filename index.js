require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { create } = require('xmlbuilder2');

// ENV değişkenlerini al
const config = {
  apiUrl: process.env.PENTA_API_URL,
  apiToken: process.env.PENTA_API_TOKEN,
  updateInterval: parseInt(process.env.UPDATE_INTERVAL_MINUTES) || 30,
  serverPort: parseInt(process.env.SERVER_PORT) || 3000,
  
  // API parametreleri
  fieldsKey: process.env.FIELDS_KEY || '',
  productType: parseInt(process.env.PRODUCT_TYPE) || 1,
  stock: process.env.STOCK === 'true',
  category: process.env.CATEGORY || '',
  brand: process.env.BRAND || '',
  productId: process.env.PRODUCT_ID || '',
  updateDate: process.env.UPDATE_DATE || '',
  page: process.env.PAGE ? parseInt(process.env.PAGE) : null,
  pageSize: process.env.PAGE_SIZE ? parseInt(process.env.PAGE_SIZE) : null
};

// Global XML cache
let cachedXml = null;
let lastUpdateTime = null;

/**
 * Penta API'den ürünleri çeker
 */
async function fetchProducts() {
  try {
    console.log(`[${new Date().toISOString()}] Penta API'den ürünler çekiliyor...`);
    
    // Request body oluştur
    const requestBody = {
      ProductType: config.productType
    };
    
    // Opsiyonel parametreleri ekle
    if (config.fieldsKey) requestBody.FieldsKey = config.fieldsKey;
    if (config.stock !== undefined) requestBody.Stock = config.stock;
    if (config.brand) requestBody.Brand = config.brand;
    if (config.productId) requestBody.ProductId = config.productId;
    if (config.updateDate) requestBody.UpdateDate = config.updateDate;
    if (config.page) requestBody.Page = config.page;
    if (config.pageSize) requestBody.PageSize = config.pageSize;
    
    // Kategori parametresini işle (virgülle ayrılmış olabilir)
    const categories = config.category ? config.category.split(',').map(c => c.trim()).filter(c => c) : [];
    
    let allProducts = [];
    
    if (categories.length > 0) {
      // Her kategori için ayrı istek at
      for (const category of categories) {
        const categoryRequest = { ...requestBody, Category: category };
        const products = await makeApiRequest(categoryRequest);
        allProducts = allProducts.concat(products);
      }
    } else {
      // Kategori belirtilmemişse tek istek at
      allProducts = await makeApiRequest(requestBody);
    }
    
    console.log(`[${new Date().toISOString()}] ${allProducts.length} ürün çekildi.`);
    return allProducts;
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] API hatası:`, error.message);
    
    // Detaylı hata bilgisi
    if (error.response) {
      console.error('=== API HATA DETAYLARI ===');
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Response Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Request URL:', error.config?.url);
      console.error('Request Params:', JSON.stringify(error.config?.params, null, 2));
      console.error('Request Headers:', JSON.stringify(error.config?.headers, null, 2));
      console.error('========================');
    }
    
    throw error;
  }
}

/**
 * API'ye istek atar (tüm sayfaları çeker)
 */
async function makeApiRequest(requestBody) {
  let allData = [];
  let currentPage = requestBody.Page || 1;
  let totalPages = 1;
  
  do {
    const params = { ...requestBody, Page: currentPage };
    
    const response = await axios({
      method: 'GET',
      url: config.apiUrl,
      headers: {
        'Authorization': config.apiToken,
        'Content-Type': 'application/json'
      },
      params: params
    });
    
    const result = response.data;
    
    // Sayfalama bilgilerini al
    if (result.pageCount) {
      totalPages = result.pageCount;
    }
    
    // Data dizisini al
    if (result.data && Array.isArray(result.data)) {
      allData = allData.concat(result.data);
      console.log(`[${new Date().toISOString()}] Sayfa ${currentPage}/${totalPages} - ${result.data.length} ürün alındı`);
    }
    
    currentPage++;
    
    // Rate limiting için küçük bekleme
    if (currentPage <= totalPages) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } while (currentPage <= totalPages && !requestBody.Page); // Eğer Page belirtilmişse sadece o sayfayı çek
  
  return allData;
}

/**
 * Ürünleri XML formatına dönüştürür (Entegra formatı - Stok attribute yapısı)
 */
function generateXml(products) {
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Products');
  
  for (const item of products) {
    const prod = item.product || {};
    const price = item.price || {};
    
    // Boyut formatı: "66,0h x 32,0w" şeklinde
    const width = prod.width || '';
    const length = prod.length || '';
    let boyut = '';
    if (length || width) {
      boyut = `${length || '0'}h x ${width || '0'}w`;
    }
    
    // Miktar formatı: "0" veya "200+" gibi
    let miktar = prod.qty || '0';
    if (parseInt(miktar) >= 200) {
      miktar = '200+';
    }
    
    // Stok elementi - tüm veriler attribute olarak
    root.ele('Stok', {
      'UstGrup_Kod': item.categoryLevel1 || '',
      'UstGrup_Ad': item.categoryLevel1Name || '',
      'AnaGrup_Kod': item.categoryLevel2 || '',
      'AnaGrup_Ad': item.categoryLevel2Name || '',
      'AltGrup_Kod': item.categoryLevel4 || '',
      'AltGrup_Ad': item.categoryLevel4Name || '',
      'Kod': prod.productID || '',
      'Ad': prod.name || '',
      'UrunGrubu': prod.materialGroupValue || '',
      'UrunGrubuKodu': prod.materialGroupID || '',
      'Doviz': price.endUserPriceCurrency || price.customerPriceCurreny || 'USD',
      'Fiyat_SKullanici': formatPrice(price.endUserPrice),
      'Fiyat_Bayi': formatPrice(price.customerPrice),
      'Fiyat_Ozel': formatPrice(price.specialPrice),
      'Miktar': miktar,
      'Garanti': String(prod.warranty || ''),
      'Marka': prod.exMaterialGroupID || '',
      'MarkaIsim': prod.exMaterialGroupValue || '',
      'Vergi': String(prod.vatRate || ''),
      'Desi': prod.volume || '',
      'UreticiKod': prod.producerPartNo || '',
      'UreticiBarkodNo': prod.ean || '',
      'Eski_Kod': prod.oldProductID || '',
      'Boyut': boyut,
      'Boyut_Birim': (length || width) ? 'cm' : '',
      'Net_Agirlik': prod.netWeight || '',
      'Brut_Agirlik': prod.grossWeight || '',
      'Mensei': prod.origin || '',
      'OzelKategori': prod.shopCategories || '',
      'Ozel_Stok': String(prod.specialStock || '0'),
      'IskontoYuzde': price.discountPercentage ? String(price.discountPercentage) : ''
    });
  }
  
  return root.end({ prettyPrint: true });
}

/**
 * Fiyatı formatlı string'e çevirir (örn: "3963.00")
 */
function formatPrice(price) {
  if (price === null || price === undefined) return '';
  const num = parseFloat(price);
  if (isNaN(num)) return '';
  return num.toFixed(2);
}

/**
 * XML'i günceller
 */
async function updateXml() {
  try {
    const products = await fetchProducts();
    cachedXml = generateXml(products);
    lastUpdateTime = new Date();
    console.log(`[${lastUpdateTime.toISOString()}] XML başarıyla güncellendi.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] XML güncellenirken hata:`, error.message);
    
    // Eğer önceden cache varsa onu kullanmaya devam et
    if (!cachedXml) {
      cachedXml = generateErrorXml(error.message);
    }
  }
}

/**
 * Hata durumunda XML oluşturur
 */
function generateErrorXml(errorMessage) {
  return create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Products', { error: 'true', generatedAt: new Date().toISOString() })
      .ele('Error').txt(errorMessage)
    .end({ prettyPrint: true });
}

/**
 * Express sunucusunu başlatır
 */
function startServer() {
  const app = express();
  
  // Ana XML endpoint
  app.get('/products.xml', (req, res) => {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'no-cache');
    
    if (cachedXml) {
      res.send(cachedXml);
    } else {
      res.send(generateErrorXml('XML henüz oluşturulmadı. Lütfen bekleyin.'));
    }
  });
  
  // Durum endpoint'i
  app.get('/status', (req, res) => {
    res.json({
      status: 'running',
      lastUpdate: lastUpdateTime ? lastUpdateTime.toISOString() : null,
      nextUpdate: lastUpdateTime 
        ? new Date(lastUpdateTime.getTime() + config.updateInterval * 60 * 1000).toISOString() 
        : null,
      config: {
        updateIntervalMinutes: config.updateInterval,
        productType: config.productType,
        categories: config.category || 'all'
      }
    });
  });
  
  // Manuel güncelleme endpoint'i
  app.post('/refresh', async (req, res) => {
    try {
      await updateXml();
      res.json({ success: true, message: 'XML başarıyla güncellendi.', updatedAt: lastUpdateTime });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Kök endpoint
  app.get('/', (req, res) => {
    res.send(`
      <html>
        <head><title>Penta-Entegra XML Servisi</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px;">
          <h1>Penta-Entegra XML Servisi</h1>
          <p>Bu servis Penta API'den ürünleri çekip XML formatında sunar.</p>
          <h2>Endpoint'ler:</h2>
          <ul>
            <li><a href="/products.xml">/products.xml</a> - Ürün XML'i</li>
            <li><a href="/status">/status</a> - Servis durumu (JSON)</li>
            <li><strong>POST /refresh</strong> - Manuel XML güncelleme</li>
          </ul>
          <h2>Durum:</h2>
          <p>Son güncelleme: ${lastUpdateTime ? lastUpdateTime.toLocaleString('tr-TR') : 'Henüz güncellenmedi'}</p>
          <p>Güncelleme aralığı: ${config.updateInterval} dakika</p>
        </body>
      </html>
    `);
  });
  
  app.listen(config.serverPort, () => {
    console.log(`[${new Date().toISOString()}] Sunucu http://localhost:${config.serverPort} adresinde çalışıyor`);
    console.log(`XML URL: http://localhost:${config.serverPort}/products.xml`);
  });
}

/**
 * Ana fonksiyon
 */
async function main() {
  console.log('='.repeat(50));
  console.log('Penta-Entegra XML Servisi Başlatılıyor...');
  console.log('='.repeat(50));
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`Güncelleme Aralığı: ${config.updateInterval} dakika`);
  console.log(`Product Type: ${config.productType}`);
  console.log(`Kategoriler: ${config.category || 'Tümü'}`);
  console.log('='.repeat(50));
  
  // İlk XML güncellemesi
  await updateXml();
  
  // Periyodik güncelleme başlat
  setInterval(updateXml, config.updateInterval * 60 * 1000);
  
  // HTTP sunucusunu başlat
  startServer();
}

// Uygulamayı başlat
main().catch(error => {
  console.error('Uygulama başlatılırken hata:', error);
  process.exit(1);
});
