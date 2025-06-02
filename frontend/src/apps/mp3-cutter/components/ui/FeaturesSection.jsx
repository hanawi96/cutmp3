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
    <section id="features" className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header - Enhanced mobile typography */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">
            Powerful Audio Editing Features
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0">
            Everything you need to cut, edit, and enhance your audio files with professional quality and ease.
          </p>
        </div>

        {/* Features Grid - Enhanced mobile layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-xl p-6 sm:p-6 hover:bg-gray-100 transition-all duration-200 group hover:shadow-md"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 leading-tight">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Section - Enhanced mobile layout */}
        <div className="text-center mt-12 sm:mt-16">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 sm:p-8 text-white mx-4 sm:mx-0">
            <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 leading-tight">
              Ready to Start Editing?
            </h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto leading-relaxed text-sm sm:text-base">
              Upload your audio file and start cutting, editing, and enhancing with our professional tools.
            </p>
            <button
              onClick={() => {
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) {
                  fileInput.click();
                } else {
                  // Scroll to top where upload section should be
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="bg-white text-blue-600 px-6 sm:px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-200 inline-flex items-center touch-manipulation hover:scale-105 text-sm sm:text-base"
            >
              <Music className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Upload Audio File
            </button>
          </div>
        </div>
      </div>
    </section>
  );
} 