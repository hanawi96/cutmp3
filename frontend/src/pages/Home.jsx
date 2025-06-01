import React, { useState } from 'react';
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
  Menu,
  X,
  CheckCircle,
  Users
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Home = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tools = [
    {
      id: 'mp3-cutter',
      name: 'MP3 Cutter',
      description: 'Cut and trim audio files with precision',
      icon: Scissors,
      link: '/mp3-cutter',
      popular: true
    },
    {
      id: 'audio-converter',
      name: 'Audio Converter',
      description: 'Convert between different audio formats',
      icon: RefreshCw,
      link: '/audio-converter'
    },
    {
      id: 'voice-recorder',
      name: 'Voice Recorder',
      description: 'Record high-quality audio in your browser',
      icon: Mic,
      link: '/voice-recorder'
    },
    {
      id: 'audio-enhancer',
      name: 'Audio Enhancer',
      description: 'Improve audio quality with filters',
      icon: Volume2,
      link: '/audio-enhancer'
    },
    {
      id: 'audio-merger',
      name: 'Audio Merger',
      description: 'Combine multiple audio files',
      icon: Merge,
      link: '/audio-merger'
    },
    {
      id: 'audio-compressor',
      name: 'Audio Compressor',
      description: 'Reduce file size, keep quality',
      icon: Minimize2,
      link: '/audio-compressor'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Free Audio Tools
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Cut, convert, and enhance your audio files. Fast, secure, and completely free.
            </p>
            <a 
              href="#tools" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 inline-flex items-center"
            >
              Choose Tool <ArrowRight className="ml-2 w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
              Audio Tools
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Professional audio editing tools for all your needs
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {tools.map((tool) => (
              <div 
                key={tool.id} 
                className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 hover:border-blue-300 hover:shadow-sm"
              >
                {/* Popular Badge */}
                {tool.popular && (
                  <div className="mb-3">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium inline-flex items-center">
                      <Star className="w-3 h-3 mr-1" />
                      Popular
                    </span>
                  </div>
                )}

                {/* Icon & Title */}
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                    <tool.icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{tool.name}</h3>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{tool.description}</p>

                {/* CTA Button */}
                <Link 
                  to={tool.link}
                  className="w-full bg-gray-100 text-gray-900 py-2.5 px-4 rounded-md font-medium hover:bg-blue-600 hover:text-white flex items-center justify-center text-sm"
                >
                  Use Tool <ArrowRight className="ml-2 w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Simple CTA */}
      <section className="py-12 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Ready to Get Started?
          </h2>
          <p className="text-blue-100 mb-6">
            Choose any tool above and start editing your audio files now.
          </p>
          <a 
            href="#tools" 
            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 inline-flex items-center"
          >
            Browse Tools <ArrowRight className="ml-2 w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Simple Footer */}
      <Footer />
    </div>
  );
};

export default Home; 