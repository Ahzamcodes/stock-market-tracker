import React, { useState, useEffect } from 'react';
import './App.css';

interface StockData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

function App() {
  const [symbol, setSymbol] = useState('');
  const [stockData, setStockData] = useState<StockData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const websocket = new WebSocket('ws://localhost:9000');
        
        websocket.onopen = () => {
          console.log('Connected to WebSocket');
        };

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket data:', data);
            if (data['Global Quote']) {
              const quote = data['Global Quote'];
              setStockData({
                symbol: quote['01. symbol'],
                price: parseFloat(quote['05. price']),
                change: parseFloat(quote['09. change']),
                changePercent: parseFloat(quote['10. change percent'].replace('%', ''))
              });
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        websocket.onerror = (err) => {
          console.error('WebSocket error:', err);
          setError('Failed to connect to WebSocket server');
        };

        return websocket;
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        setError('Failed to create WebSocket connection');
        return null;
      }
    };

    const ws = connectWebSocket();

    return () => {
      ws?.close();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol) return;

    try {
      setError('');
      console.log(`Fetching stock data for: ${symbol}`);
      const response = await fetch(`http://localhost:3001/api/stocks/${symbol}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Received data:', data);
      
      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        setStockData({
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: parseFloat(quote['10. change percent'].replace('%', ''))
        });

        // Send subscription message to WebSocket
        const ws = new WebSocket('ws://localhost:9000');
        ws.onopen = () => {
          console.log('Sending subscription to WebSocket');
          ws.send(JSON.stringify({ type: 'SUBSCRIBE_STOCK', symbol }));
        };
      } else {
        setError('Could not find stock data');
      }
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError('Failed to fetch stock data');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Stock Market Price Tracker</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Enter stock symbol (e.g., AAPL)"
            required
          />
          <button type="submit">Track Stock</button>
        </form>
        {error && <p className="error">{error}</p>}
        {stockData && (
          <div className="stock-data">
            <h2>{stockData.symbol}</h2>
            <p>Price: ${stockData.price.toFixed(2)}</p>
            <p className={stockData.change >= 0 ? 'positive' : 'negative'}>
              Change: ${stockData.change.toFixed(2)} ({stockData.changePercent.toFixed(2)}%)
            </p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App; 