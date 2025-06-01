import React from 'react';
import { Scissors, Zap, Shield, Download, Settings, Music } from 'lucide-react';

export default function FeaturesSection() {
  const features = [
    {
      icon: Scissors,
      title: "Precise Audio Cutting",
      description: "Cut your audio files with millisecond precision. Visual waveform editor for accurate selection."
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Process your audio files quickly with our optimized algorithms. No waiting, instant results."
    },
    {
      icon: Shield,
      title: "100% Secure",
      description: "Your files are processed locally and securely. We don't store or share your audio files."
    },
    {
      icon: Settings,
      title: "Advanced Controls",
      description: "Volume adjustment, fade effects, speed control, and pitch modification for professional results."
    },
    {
      icon: Download,
      title: "Multiple Formats",
      description: "Export your audio in various formats: MP3, WAV, M4A, AAC, OGG, and more."
    },
    {
      icon: Music,
      title: "High Quality",
      description: "Maintain audio quality with lossless processing and professional-grade audio algorithms."
    }
  ];

  return (
    <section id="features" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Powerful Audio Editing Features
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Everything you need to cut, edit, and enhance your audio files with professional quality and ease.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors group"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">
              Ready to Start Editing?
            </h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Upload your audio file and start cutting, editing, and enhancing with our professional tools.
            </p>
            <button
              onClick={() => document.querySelector('input[type="file"]')?.click()}
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center"
            >
              <Music className="w-5 h-5 mr-2" />
              Upload Audio File
            </button>
          </div>
        </div>
      </div>
    </section>
  );
} 