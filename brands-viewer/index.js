require('dotenv').config();
const express = require('express');
const axios = require('axios');

const config = {
  apiUrl: process.env.PENTA_BRANDS_API_URL,
  apiToken: process.env.PENTA_API_TOKEN,
  serverPort: parseInt(process.env.SERVER_PORT) || 3001
};

const app = express();

/**
 * Penta API'den markaları çeker
 */
async function fetchBrands() {
  const response = await axios({
    method: 'GET',
    url: config.apiUrl,
    headers: {
      'Authorization': config.apiToken,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

/**
 * Ana sayfa - Marka listesi
 */
app.get('/', async (req, res) => {
  try {
    const result = await fetchBrands();
    const brands = result.data || [];
    
    const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Penta Marka Listesi</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { 
      color: #333; 
      margin-bottom: 10px;
      font-size: 28px;
    }
    .info {
      color: #666;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .search-box {
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      border: 2px solid #ddd;
      border-radius: 8px;
      margin-bottom: 20px;
      outline: none;
    }
    .search-box:focus { border-color: #007bff; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    th, td { 
      padding: 14px 16px; 
      text-align: left; 
      border-bottom: 1px solid #eee;
    }
    th { 
      background: #007bff; 
      color: white; 
      font-weight: 600;
      position: sticky;
      top: 0;
    }
    tr:hover { background: #f8f9fa; }
    tr:last-child td { border-bottom: none; }
    .brand-code { 
      font-family: monospace; 
      background: #e9ecef;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 13px;
    }
    .count { 
      background: #28a745;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      margin-left: 10px;
    }
    .message {
      background: #d4edda;
      color: #155724;
      padding: 10px 16px;
      border-radius: 6px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Penta Marka Listesi <span class="count">${brands.length} marka</span></h1>
    <p class="info">Son güncelleme: ${new Date().toLocaleString('tr-TR')}</p>
    
    ${result.message ? `<div class="message">${result.message}</div>` : ''}
    
    <input type="text" class="search-box" id="search" placeholder="Marka ara..." onkeyup="filterTable()">
    
    <table id="brandsTable">
      <thead>
        <tr>
          <th>#</th>
          <th>Marka Kodu</th>
          <th>Marka Adı</th>
        </tr>
      </thead>
      <tbody>
        ${brands.map((brand, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><span class="brand-code">${brand.brandCode || ''}</span></td>
          <td>${brand.brandName || ''}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <script>
    function filterTable() {
      const input = document.getElementById('search').value.toLowerCase();
      const rows = document.querySelectorAll('#brandsTable tbody tr');
      
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(input) ? '' : 'none';
      });
    }
  </script>
</body>
</html>
    `;
    
    res.send(html);
    
  } catch (error) {
    console.error('API Hatası:', error.message);
    
    let errorDetail = error.message;
    if (error.response) {
      errorDetail = `Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    }
    
    res.status(500).send(`
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>Hata</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
    .error { 
      background: #f8d7da; 
      color: #721c24; 
      padding: 20px; 
      border-radius: 8px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { margin-bottom: 10px; }
    pre { 
      background: #fff; 
      padding: 15px; 
      border-radius: 4px; 
      overflow-x: auto;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="error">
    <h1>API Hatası</h1>
    <p>Marka listesi alınırken bir hata oluştu.</p>
    <pre>${errorDetail}</pre>
  </div>
</body>
</html>
    `);
  }
});

/**
 * JSON endpoint
 */
app.get('/api/brands', async (req, res) => {
  try {
    const result = await fetchBrands();
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data 
    });
  }
});

app.listen(config.serverPort, () => {
  console.log(`Marka Listesi Servisi: http://localhost:${config.serverPort}`);
});
