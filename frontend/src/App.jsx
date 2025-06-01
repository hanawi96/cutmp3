import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';

// Lazy load các apps để tối ưu performance
const Mp3Cutter = React.lazy(() => import('./apps/mp3-cutter'));
const ImageCompressor = React.lazy(() => import('./apps/image-compressor'));
const YoutubeDownloader = React.lazy(() => import('./apps/youtube-downloader'));

function App() {
  return (
    <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mp3-cutter" element={<Mp3Cutter />} />
          <Route path="/image-compressor" element={<ImageCompressor />} />
          <Route path="/youtube-downloader" element={<YoutubeDownloader />} />
        </Routes>
    </Router>
  );
}

export default App; 