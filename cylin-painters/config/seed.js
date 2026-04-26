require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const SiteContent = require('../models/SiteContent');
const User = require('../models/User');

const defaultContent = [
  {
    section: 'hero',
    data: {
      title: 'Transform Your Space<br>With Color',
      subtitle: 'Premium residential & commercial painting services that bring your vision to life with precision and artistry.',
      primaryButton: 'Get a Free Quote',
      secondaryButton: 'View Our Work'
    }
  },
  {
    section: 'services',
    data: {
      tag: 'What We Do',
      title: 'Our Services',
      description: 'From cozy homes to grand commercial spaces, we deliver flawless finishes every time.',
      items: [
        { icon: 'fa-home', title: 'Residential Painting', description: 'Interior and exterior painting for homes, apartments, and condos. We treat your home with the care it deserves.' },
        { icon: 'fa-building', title: 'Commercial Painting', description: 'Offices, retail stores, warehouses, and industrial facilities. Minimal disruption to your business operations.' },
        { icon: 'fa-couch', title: 'Interior Painting', description: 'Walls, ceilings, trim, cabinets, and specialty finishes. Color consultation included with every project.' },
        { icon: 'fa-sun', title: 'Exterior Painting', description: 'Siding, stucco, decks, fences, and more. Weather-resistant coatings that stand the test of time.' },
        { icon: 'fa-palette', title: 'Custom Finishes', description: 'Textured walls, faux finishes, accent walls, murals, and decorative painting for unique spaces.' },
        { icon: 'fa-tools', title: 'Surface Preparation', description: 'Power washing, sanding, caulking, drywall repair, and priming for a perfect, long-lasting finish.' }
      ]
    }
  },
  {
    section: 'gallery',
    data: {
      tag: 'Portfolio',
      title: 'Our Gallery',
      description: 'Browse through our completed projects and imagine the possibilities for your space.',
      items: [
        { src: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80', title: 'Modern Living Room', category: 'Interior' },
        { src: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', title: 'Elegant Bedroom', category: 'Interior' },
        { src: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80', title: 'Fresh Kitchen', category: 'Interior' },
        { src: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80', title: 'Bathroom Refresh', category: 'Interior' },
        { src: 'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&q=80', title: 'Exterior Facade', category: 'Exterior' },
        { src: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80', title: 'Office Space', category: 'Commercial' },
        { src: 'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&q=80', title: 'Bold Dining Room', category: 'Interior' },
        { src: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=800&q=80', title: 'Retail Store', category: 'Commercial' }
      ]
    }
  },
  {
    section: 'about',
    data: {
      tag: 'About Us',
      title: 'Bringing Color to Life Since 2009',
      description: 'Cylin Painters is a full-service painting company dedicated to transforming spaces with color, creativity, and craftsmanship. Founded on the principles of quality, integrity, and customer satisfaction, we have grown to become one of the most trusted names in the industry.',
      description2: 'Our team of skilled professionals brings years of experience to every project, ensuring meticulous attention to detail and a flawless finish. We use only premium paints and materials, combined with proven techniques, to deliver results that exceed expectations.',
      image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&q=80',
      experience: { number: '15+', text: 'Years of<br>Experience' },
      features: [
        'Licensed & Insured',
        'Free Estimates',
        'Satisfaction Guaranteed',
        'Eco-Friendly Options'
      ]
    }
  },
  {
    section: 'stats',
    data: {
      items: [
        { number: 1200, label: 'Projects Completed' },
        { number: 850, label: 'Happy Clients' },
        { number: 25, label: 'Expert Painters' },
        { number: 15, label: 'Years Experience' }
      ]
    }
  },
  {
    section: 'contact',
    data: {
      tag: 'Get In Touch',
      title: 'Request a Free Quote',
      description: 'Ready to transform your space? Fill out the form below and we\'ll get back to you within 24 hours.',
      info: {
        address: '123 Color Avenue\nDesign District, NY 10001',
        phone: '(555) 123-4567\nMon - Sat: 8am - 6pm',
        email: 'info@cylinpainters.com\nquotes@cylinpainters.com'
      }
    }
  },
  {
    section: 'footer',
    data: {
      description: 'Premium painting services for residential and commercial spaces. Quality craftsmanship, exceptional results.',
      copyright: '© 2024 Cylin Painters. All rights reserved.'
    }
  }
];

async function seedDatabase() {
  await connectDB();

  try {
    // Seed site content
    for (const content of defaultContent) {
      await SiteContent.findOneAndUpdate(
        { section: content.section },
        { ...content, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    }
    console.log('Site content seeded successfully');

  // Seed admin user
    const existingAdmin = await User.findOne({ username: process.env.ADMIN_USERNAME || 'eutectciemmanuel@gmail.com' });
    if (!existingAdmin) {
      await User.create({
        username: process.env.ADMIN_USERNAME || 'eutectciemmanuel@gmail.com',
        password: process.env.ADMIN_PASSWORD || 'St!lla18'
      });
      console.log('Admin user created successfully');
      console.log(`Username: ${process.env.ADMIN_USERNAME || 'eutectciemmanuel@gmail.com'}`);
      console.log(`Password: ${process.env.ADMIN_PASSWORD || 'St!lla18'}`);
    } else {
      console.log('Admin user already exists');
    }

    console.log('Database seeding completed');
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    mongoose.connection.close();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;

