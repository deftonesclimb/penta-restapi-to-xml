require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { create } = require('xmlbuilder2');
const fs = require('fs');
const path = require('path');

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
  pageSize: process.env.PAGE_SIZE ? parseInt(process.env.PAGE_SIZE) : null,
  debugApi: process.env.DEBUG_API === 'true'
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
 * Manuel XML oluşturma - her element ayrı satırda
 */
function generateXml(products) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<Products>\n';
  
  for (const item of products) {
    const prod = item.product || {};
    const price = item.price || {};
    
    // Toplam stok: qty (2001) + dış depo (2011)
    const baseStock = parseInt(prod.qty, 10) || 0;
    const externalStock = getExternalStock(item.storageStocks);
    const totalStock = baseStock + externalStock;
    
    xml += '  <Product>\n';
    xml += `    <UstGrup_Ad><![CDATA[${item.categoryLevel1Name || ''}]]></UstGrup_Ad>\n`;
    xml += `    <AnaGrup_Ad><![CDATA[${item.categoryLevel2Name || ''}]]></AnaGrup_Ad>\n`;
    xml += `    <AltGrup_Ad><![CDATA[${item.categoryLevel4Name || ''}]]></AltGrup_Ad>\n`;
    xml += `    <Kod>${escapeXml(prod.productID || '')}</Kod>\n`;
    xml += `    <Ad><![CDATA[${prod.description || ''}]]></Ad>\n`;
    xml += `    <UrunGrubu><![CDATA[${prod.materialGroupValue || ''}]]></UrunGrubu>\n`;
    xml += `    <UrunGrubuKodu>${escapeXml(prod.materialGroupID || '')}</UrunGrubuKodu>\n`;
    xml += `    <Doviz>${escapeXml(price.endUserPriceCurrency || price.customerPriceCurreny || 'USD')}</Doviz>\n`;
    xml += `    <Fiyat_SKullanici>${price.endUserPrice != null ? Number(price.endUserPrice).toFixed(2) : ''}</Fiyat_SKullanici>\n`;
    xml += `    <Fiyat_Bayi>${price.customerPrice != null ? Number(price.customerPrice).toFixed(2) : ''}</Fiyat_Bayi>\n`;
    xml += `    <Fiyat_Ozel>${price.specialPrice != null ? Number(price.specialPrice).toFixed(2) : ''}</Fiyat_Ozel>\n`;
    xml += `    <Miktar>${totalStock}</Miktar>\n`;
    xml += `    <Marka>${escapeXml(prod.exMaterialGroupID || '')}</Marka>\n`;
    xml += `    <MarkaIsim><![CDATA[${prod.exMaterialGroupValue || ''}]]></MarkaIsim>\n`;
    xml += `    <Vergi>${prod.vatRate != null ? prod.vatRate : ''}</Vergi>\n`;
    xml += `    <UreticiBarkodNo>${escapeXml(prod.ean || '')}</UreticiBarkodNo>\n`;
    xml += '  </Product>\n';
  }
  
  xml += '</Products>';
  return xml;
}

/**
 * storageStocks dizisinden 2011 (dış depo) stoğunu alır
 */
function getExternalStock(storageStocks) {
  if (!storageStocks || !Array.isArray(storageStocks)) return 0;
  
  for (const storage of storageStocks) {
    if (storage.storagePlace === '2011') {
      // "200+" gibi değerleri işle
      const stockStr = String(storage.stock || '0').replace('+', '');
      const stockNum = parseInt(stockStr, 10);
      return isNaN(stockNum) ? 0 : stockNum;
    }
  }
  
  return 0;
}

/**
 * OzelKategori alanını temizler - sadece virgüllerden oluşuyorsa boş döner
 */
function cleanOzelKategori(value) {
  if (!value) return '';
  // Sadece virgüllerden oluşuyorsa boş döndür
  const cleaned = String(value).replace(/,/g, '').trim();
  return cleaned === '' ? '' : String(value);
}

/**
 * XML için özel karakterleri escape eder
 */
function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


/**
 * XML'i günceller
 */
async function updateXml() {
  try {
    const products = await fetchProducts();
    
    // Debug: API cevabını txt dosyasına kaydet (sadece DEBUG_API=true ise)
    if (config.debugApi) {
      const debugPath = path.join(__dirname, 'debug-api-response.txt');
      fs.writeFileSync(debugPath, JSON.stringify(products, null, 2), 'utf8');
      console.log(`[DEBUG] API cevabı kaydedildi: ${debugPath}`);
    }
    
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
