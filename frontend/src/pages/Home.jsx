import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Scissors, 
  RefreshCw, 
  Mic, 
  Volume2, 
  Merge, 
  Minimize2,
  Star,
  ArrowRight,
  Play,
  Users,
  Download,
  Trophy,
  Menu,
  X,
  ChevronUp
} from 'lucide-react';

const Home = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Handle scroll for back to top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const tools = [
    {
      id: 'mp3-cutter',
      name: 'MP3 Cutter',
      description: 'Cut and trim your audio files with precision',
      icon: Scissors,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600',
      link: '/mp3-cutter',
      popular: true,
      features: ['Precise cutting', 'Multiple formats', 'No quality loss']
    },
    {
      id: 'audio-converter',
      name: 'Audio Converter',
      description: 'Convert between different audio formats',
      icon: RefreshCw,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
      link: '/audio-converter',
      features: ['50+ formats', 'Batch conversion', 'High quality']
    },
    {
      id: 'voice-recorder',
      name: 'Voice Recorder',
      description: 'Record high-quality audio directly in your browser',
      icon: Mic,
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-600',
      link: '/voice-recorder',
      features: ['HD recording', 'Real-time preview', 'Easy sharing']
    },
    {
      id: 'audio-enhancer',
      name: 'Audio Enhancer',
      description: 'Improve audio quality with advanced filters',
      icon: Volume2,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
      link: '/audio-enhancer',
      features: ['Noise reduction', 'Auto enhance', 'Custom filters']
    },
    {
      id: 'audio-merger',
      name: 'Audio Merger',
      description: 'Combine multiple audio files into one',
      icon: Merge,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
      link: '/audio-merger',
      features: ['Multiple files', 'Seamless merge', 'Custom order']
    },
    {
      id: 'audio-compressor',
      name: 'Audio Compressor',
      description: 'Reduce file size while maintaining quality',
      icon: Minimize2,
      color: 'bg-teal-500',
      hoverColor: 'hover:bg-teal-600',
      link: '/audio-compressor',
      features: ['Smart compression', 'Quality control', 'Fast processing']
    }
  ];

  const stats = [
    { icon: Play, value: '1M+', label: 'Files Processed' },
    { icon: Users, value: '50K+', label: 'Happy Users' },
    { icon: Download, value: '500K+', label: 'Downloads' },
    { icon: Trophy, value: '4.9/5', label: 'User Rating' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AudioTools
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#tools" className="text-gray-600 hover:text-blue-600 transition-colors">Tools</a>
              <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Features</a>
              <a href="#about" className="text-gray-600 hover:text-blue-600 transition-colors">About</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 transition-colors">Contact</a>
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-blue-600 transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <nav className="flex flex-col space-y-4">
                <a href="#tools" className="text-gray-600 hover:text-blue-600 transition-colors">Tools</a>
                <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Features</a>
                <a href="#about" className="text-gray-600 hover:text-blue-600 transition-colors">About</a>
                <a href="#contact" className="text-gray-600 hover:text-blue-600 transition-colors">Contact</a>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Professional Audio Tools
              </span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Everything you need to edit, convert, and enhance your audio files. 
              Fast, secure, and completely free to use.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="#tools" 
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-full font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-200 inline-flex items-center justify-center"
              >
                Get Started <ArrowRight className="ml-2 w-5 h-5" />
              </a>
              <a 
                href="#features" 
                className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-full font-medium hover:border-blue-500 hover:text-blue-600 transition-all duration-200 inline-flex items-center justify-center"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>

        {/* Background decoration */}
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg mb-4">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Audio Tools Suite
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Professional-grade audio tools designed for creators, musicians, and audio enthusiasts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tools.map((tool) => (
              <div 
                key={tool.id} 
                className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden"
              >
                {/* Popular Badge */}
                {tool.popular && (
                  <div className="absolute top-4 right-4 z-10">
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-medium flex items-center">
                      <Star className="w-3 h-3 mr-1" fill="currentColor" />
                      Popular
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Icon */}
                  <div className={`inline-flex items-center justify-center w-16 h-16 ${tool.color} rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <tool.icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{tool.name}</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">{tool.description}</p>

                  {/* Features */}
                  <ul className="space-y-2 mb-8">
                    {tool.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mr-3"></div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Link 
                    to={tool.link}
                    className={`w-full bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 py-3 px-6 rounded-xl font-medium transition-all duration-300 group-hover:from-blue-500 group-hover:to-purple-600 group-hover:text-white flex items-center justify-center`}
                  >
                    Try Now <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>

                {/* Hover gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Why Choose AudioTools?
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built with the latest technology to provide you with the best audio editing experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl mb-6">
                <Volume2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">High Quality</h3>
              <p className="text-gray-600">Professional-grade audio processing with no quality loss.</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl mb-6">
                <RefreshCw className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Fast Processing</h3>
              <p className="text-gray-600">Lightning-fast audio processing powered by advanced algorithms.</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl mb-6">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Free to Use</h3>
              <p className="text-gray-600">All tools are completely free with no hidden charges or subscriptions.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Logo and description */}
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Volume2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">AudioTools</span>
              </div>
              <p className="text-gray-300 mb-4">
                Professional audio tools for creators, musicians, and audio enthusiasts. 
                Fast, secure, and completely free to use.
              </p>
            </div>

            {/* Tools */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Tools</h3>
              <ul className="space-y-2">
                <li><Link to="/mp3-cutter" className="text-gray-300 hover:text-white transition-colors">MP3 Cutter</Link></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Audio Converter</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Voice Recorder</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Audio Enhancer</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Contact Us</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-300 hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <p className="text-gray-300">
              © 2024 AudioTools. All rights reserved. Built with ❤️ for audio creators.
            </p>
          </div>
        </div>
      </footer>

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 z-50"
          aria-label="Back to top"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Home; 