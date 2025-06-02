import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Scissors, 
  RefreshCw, 
  Mic, 
  Volume2, 
  Merge, 
  Minimize2,
  ArrowRight,
  Menu,
  CheckCircle,
  Users,
  Award,
  Globe,
  Headphones,
  Download,
  Smartphone,
  Edit3,
  Music,
  Lock,
  Shield,
  Star,
  Clock,
  Zap,
  TrendingUp
} from 'lucide-react';
import SharedHeader from '../components/SharedHeader';
import SharedFooter from '../components/SharedFooter';

const Home = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const popularTools = [
    {
      name: 'Cut MP3',
      description: 'Cut and trim MP3 files with precision',
      icon: Scissors,
      link: '/mp3-cutter',
      popular: true
    },
    {
      name: 'MP3 to WAV',
      description: 'Convert MP3 files to WAV format',
      icon: RefreshCw,
      link: '/mp3-to-wav'
    },
    {
      name: 'Merge Audio',
      description: 'Combine multiple audio files',
      icon: Merge,
      link: '/audio-merger'
    },
    {
      name: 'Audio to MP3',
      description: 'Convert audio files to MP3',
      icon: Music,
      link: '/audio-converter'
    },
    {
      name: 'Voice Recorder',
      description: 'Record audio in your browser',
      icon: Mic,
      link: '/voice-recorder'
    },
    {
      name: 'Compress Audio',
      description: 'Reduce file size efficiently',
      icon: Minimize2,
      link: '/audio-compressor'
    }
  ];

  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Process files in seconds, not minutes. No waiting around.',
    },
    {
      icon: Lock,
      title: '100% Secure',
      description: 'Your files never leave your device. Complete privacy guaranteed.',
    },
    {
      icon: Smartphone,
      title: 'Works Everywhere',
      description: 'Any device, any browser. iPhone, Android, Mac, PC - we got you.',
    }
  ];

  const testimonials = [
    {
      text: "Game changer for my podcast. Super fast and the quality is incredible. Been using it for 6 months now.",
      author: "Sarah Chen",
      role: "Podcast Producer",
      company: "TechTalk Media",
      rating: 5,
      avatar: "SC"
    },
    {
      text: "Finally, audio tools that just work. No complicated software to install. Perfect for our remote team.",
      author: "Marcus Johnson", 
      role: "Content Creator",
      company: "Digital Nomads",
      rating: 5,
      avatar: "MJ"
    },
    {
      text: "Love that my files stay private. Other tools upload everything to servers. This keeps everything local.",
      author: "Emily Rodriguez",
      role: "Music Producer",
      company: "Indie Records",
      rating: 5,
      avatar: "ER"
    }
  ];

  const stats = [
    { number: '2.3M+', label: 'Files Processed' },
    { number: '50K+', label: 'Happy Users' },
    { number: '99.9%', label: 'Uptime' },
    { number: '4.9/5', label: 'User Rating' }
  ];

  const trustBadges = [
    { name: 'SSL Secured', icon: Lock },
    { name: 'GDPR Compliant', icon: Shield },
    { name: 'SOC 2 Certified', icon: Award },
    { name: '24/7 Support', icon: Headphones }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <SharedHeader />

      <main>
        {/* Hero Section - Enhanced with Social Proof */}
        <section className="py-20 bg-gradient-to-b from-gray-50/30 to-white">
          <div className="max-w-4xl mx-auto text-center px-6">
            {/* Social Proof Badge */}
            <div className="inline-flex items-center bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-full px-4 py-2 mb-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center">
                <div className="flex -space-x-1 mr-3">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-2 border-white shadow-sm"></div>
                  <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-600 rounded-full border-2 border-white shadow-sm"></div>
                  <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full border-2 border-white shadow-sm"></div>
                </div>
                <span className="text-sm font-medium text-green-800">50,000+ users this month</span>
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-6 leading-tight">
              Professional audio tools.
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Convert, edit, and compress audio files in seconds. Works on any device. Your files never leave your computer.
            </p>

            {/* Value Props */}
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-gray-600">
              <div className="flex items-center bg-white/60 backdrop-blur-sm px-3 py-2 rounded-full border border-gray-100 shadow-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                Free forever
              </div>
              <div className="flex items-center bg-white/60 backdrop-blur-sm px-3 py-2 rounded-full border border-gray-100 shadow-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                No credit card required
              </div>
              <div className="flex items-center bg-white/60 backdrop-blur-sm px-3 py-2 rounded-full border border-gray-100 shadow-sm">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                100% private & secure
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/trial" className="bg-gray-900 text-white px-8 py-4 rounded-lg font-medium hover:bg-gray-800 text-lg transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
                Get Started Free →
              </Link>
              <Link to="/tools" className="border border-gray-200 text-gray-700 px-8 py-4 rounded-lg hover:border-gray-300 hover:bg-gray-50 text-lg transition-all duration-200 shadow-sm hover:shadow-md">
                Browse Tools
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-t border-gray-100">
              {stats.map((stat, index) => (
                <div key={index} className="text-center group cursor-default">
                  <div className="text-2xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors duration-200">{stat.number}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
        </div>
      </section>

        {/* Tools Grid - Enhanced */}
        <section className="py-16 bg-gradient-to-b from-gray-50 to-gray-50/30">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Most popular tools
            </h2>
              <p className="text-gray-600">Used by thousands of creators every day</p>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularTools.map((tool, index) => (
                <Link 
                  key={index}
                  to={tool.link}
                  className="relative bg-white p-6 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg group transition-all duration-300 transform hover:-translate-y-1"
                >
                {tool.popular && (
                    <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-2 py-1 rounded-full shadow-sm">
                      Popular
                    </div>
                  )}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center group-hover:from-gray-100 group-hover:to-gray-200 transition-all duration-300 shadow-sm">
                      <tool.icon className="w-5 h-5 text-gray-600 group-hover:text-gray-700 transition-colors duration-300" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2 group-hover:text-gray-700 transition-colors duration-200">{tool.name}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{tool.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section - Value-focused */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Why 50,000+ users choose AudioTools
              </h2>
              <p className="text-gray-600">
                Built for speed, security, and simplicity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="text-center group cursor-default">
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:from-gray-100 group-hover:to-gray-200 transition-all duration-300 shadow-sm group-hover:shadow-md transform group-hover:scale-105">
                    <feature.icon className="w-6 h-6 text-gray-600 group-hover:text-gray-700 transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3 group-hover:text-gray-700 transition-colors duration-200">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials - Social Proof */}
        <section className="py-16 bg-gradient-to-b from-gray-50/30 to-gray-50">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Loved by creators worldwide
              </h2>
              <div className="flex items-center justify-center mb-4">
                <div className="flex items-center">
                  {[1,2,3,4,5].map((star) => (
                    <Star key={star} className="w-5 h-5 text-yellow-400 fill-current drop-shadow-sm" />
                  ))}
                  <span className="ml-2 text-sm text-gray-600">4.9/5 from 1,247 reviews</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-105">
                  <div className="flex items-center mb-4">
                    {[1,2,3,4,5].map((star) => (
                      <Star key={star} className="w-4 h-4 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4 leading-relaxed text-sm">&ldquo;{testimonial.text}&rdquo;</p>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mr-3 text-sm font-medium text-gray-600">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{testimonial.author}</div>
                      <div className="text-xs text-gray-600">{testimonial.role} at {testimonial.company}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* App Download - Mobile */}
        <section className="py-16 bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 md:p-12 text-center">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                Take AudioTools anywhere
              </h2>
              <p className="text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                Download our mobile apps and work with audio files on the go. Same powerful tools, optimized for your phone and tablet.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Link to="#" className="flex items-center justify-center bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  <Download className="w-5 h-5 mr-2" />
                  App Store
                </Link>
                <Link to="#" className="flex items-center justify-center bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
                  <Download className="w-5 h-5 mr-2" />
                  Google Play
                </Link>
              </div>

              <p className="text-sm text-gray-500">
                ⭐ 4.8/5 stars on App Store • 4.9/5 on Google Play
              </p>
            </div>
          </div>
        </section>

        {/* Pricing - Enhanced */}
        <section className="py-16 bg-gradient-to-b from-gray-50/30 to-gray-50">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Simple, honest pricing</h2>
            <p className="text-gray-600 mb-12 leading-relaxed">
              Start free, upgrade when you need more. No hidden fees, cancel anytime.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Free Plan */}
              <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Free</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-1">$0</div>
                  <p className="text-gray-600">Perfect for personal use</p>
                </div>

                <ul className="space-y-3 mb-6 text-left">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">10 files per day</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">All basic tools</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">Mobile apps</span>
                  </li>
                </ul>

                <Link to="/signup" className="w-full bg-gray-100 text-gray-900 py-3 px-4 rounded-lg text-sm hover:bg-gray-200 inline-block font-medium transform hover:scale-105 transition-all duration-200">
                  Get Started Free
                </Link>
              </div>

              {/* Pro Plan */}
              <div className="bg-white p-8 rounded-xl border-2 border-gray-900 relative shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-gray-900 to-gray-700 text-white px-4 py-1 rounded-full text-xs font-medium shadow-md">
                    Most Popular
                  </span>
                </div>

                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Pro</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-1">$9</div>
                  <div className="text-sm text-gray-600 mb-2">per month</div>
                  <p className="text-gray-600">For professionals and teams</p>
                </div>
                
                <ul className="space-y-3 mb-6 text-left">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">Unlimited files</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">Advanced editing tools</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">Priority support</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">Team collaboration</span>
                  </li>
                </ul>

                <Link to="/trial" className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg text-sm hover:bg-gray-800 inline-block font-medium transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg">
                  Start 7-Day Free Trial
                </Link>
                <p className="text-xs text-gray-500 mt-2 text-center">No credit card required</p>
              </div>
            </div>

            {/* Money Back Guarantee */}
            <div className="mt-8 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
              <p className="text-sm text-green-800">
                <Shield className="w-4 h-4 inline mr-2" />
                30-day money-back guarantee. Try risk-free.
              </p>
            </div>
          </div>
        </section>

        {/* Trust Badges */}
        <section className="py-12 border-t border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500 mb-6">Trusted by professionals worldwide</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {trustBadges.map((badge, index) => (
                <div key={index} className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md">
                  <badge.icon className="w-5 h-5 text-gray-600 mr-2" />
                  <span className="text-sm font-medium text-gray-700">{badge.name}</span>
                </div>
              ))}
          </div>
        </div>
      </section>

        {/* Final CTA - Enhanced */}
        <section className="py-16 bg-gradient-to-br from-gray-900 to-gray-800">
          <div className="max-w-3xl mx-auto text-center px-6">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Ready to transform your audio workflow?
          </h2>
            <p className="text-gray-300 mb-8 leading-relaxed">
              Join 50,000+ users who've made the switch. Start free, no credit card required.
            </p>
            <Link to="/trial" className="bg-white text-gray-900 px-8 py-4 rounded-lg hover:bg-gray-100 font-medium text-lg inline-block transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
              Get Started Free →
            </Link>
            <p className="text-sm text-gray-400 mt-4">
              ✓ Free forever plan available ✓ Cancel anytime ✓ No setup fees
            </p>
        </div>
      </section>
      </main>

      {/* Footer */}
      <SharedFooter />
    </div>
  );
};

export default Home; 