import express from 'express';
import cors from 'cors';
import { WebSocket, WebSocketServer } from 'ws';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// MySQL Connection (optional)
let db: any = null;
const initDb = async () => {
  try {
    db = await createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'stock_tracker'
    });
    console.log('Connected to MySQL database');
  } catch (error) {
    console.warn('Warning: MySQL connection failed. Running without database.');
  }
};

app.use(cors());
app.use(express.json());

// WebSocket server
const wss = new WebSocketServer({ port: 9000 });
console.log('WebSocket server started on port 9000');

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');

  ws.on('message', async (message: string) => {
    const data = JSON.parse(message.toString());
    if (data.type === 'SUBSCRIBE_STOCK') {
      try {
        // Check if we have an API key
        if (!process.env.ALPHA_VANTAGE_API_KEY) {
          // Return mock data if no API key is available
          console.log(`WebSocket: No API key found. Returning mock data for ${data.symbol}`);
          ws.send(JSON.stringify({
            "Global Quote": {
              "01. symbol": data.symbol,
              "05. price": (Math.random() * 1000 + 50).toFixed(2),
              "09. change": (Math.random() * 20 - 10).toFixed(2),
              "10. change percent": `${(Math.random() * 5 - 2.5).toFixed(2)}%`
            }
          }));
          return;
        }
        
        // Use real API if key is available
        const response = await axios.get(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${data.symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
        );
        ws.send(JSON.stringify(response.data));
      } catch (error) {
        console.error('Error fetching stock data:', error);
        ws.send(JSON.stringify({ error: 'Failed to fetch stock data' }));
      }
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// API Routes
app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Check if we have an API key
    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      // Return mock data if no API key is available
      console.log(`No API key found. Returning mock data for ${symbol}`);
      return res.json({
        "Global Quote": {
          "01. symbol": symbol,
          "05. price": (Math.random() * 1000 + 50).toFixed(2),
          "09. change": (Math.random() * 20 - 10).toFixed(2),
          "10. change percent": `${(Math.random() * 5 - 2.5).toFixed(2)}%`
        }
      });
    }
    
    console.log(`Fetching data for ${symbol} with API key: ${process.env.ALPHA_VANTAGE_API_KEY}`);
    // Use real API if key is available
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
    );
    
    console.log('API response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Failed to fetch stock data:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

// Store transaction
app.post('/api/transactions', async (req, res) => {
  if (!db) {
    return res.status(503).json({ error: 'Database not available' });
  }
  
  try {
    const { symbol, price, quantity, type } = req.body;
    await db.execute(
      'INSERT INTO transactions (symbol, price, quantity, type) VALUES (?, ?, ?, ?)',
      [symbol, price, quantity, type]
    );
    res.status(201).json({ message: 'Transaction stored successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to store transaction' });
  }
});

// Initialize database connection and start server
initDb().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}); 