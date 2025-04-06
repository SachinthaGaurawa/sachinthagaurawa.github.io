// Full portfolio website for Sachintha Gaurawa
// Best-ever portfolio with typing effect, CV download with reCAPTCHA v3, contact section, WhatsApp & LinkedIn icons, scroll animations

import React, { useEffect } from "react";
import Typed from "react-typed";
import { FaWhatsapp, FaLinkedin } from "react-icons/fa";
import { motion } from "framer-motion";

export default function Portfolio() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?render=6Le78QsrAAAAAIBOzYPgyO6iedOhoL3rtYPiRsMD";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handleDownload = () => {
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute("6Le78QsrAAAAAIBOzYPgyO6iedOhoL3rtYPiRsMD", { action: "download" })
          .then((token) => {
            // Normally you'd send token to backend for verification, but we skip that here
            const link = document.createElement("a");
            link.href = "https://sachinthagaurawa.github.io/Sachintha%20Gaurawa_Resume.pdf";
            link.setAttribute("download", "Sachintha_Gaurawa_Resume.pdf");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          });
      });
    } else {
      console.error("reCAPTCHA not loaded");
    }
  };

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Hero Section */}
      <div className="text-center py-20 px-4">
        <h1 className="text-5xl md:text-6xl font-bold">
          Hi, I'm <span className="text-blue-400">Sachintha Gaurawa</span>
        </h1>
        <Typed
          className="text-2xl md:text-3xl text-gray-300 mt-6 block"
          strings={[
            "I am an Electronic Engineer.",
            "I am an Electrical Engineer.",
            "I am a PCB Designer."
          ]}
          typeSpeed={50}
          backSpeed={30}
          loop
        />
        <div className="mt-10">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white py-3 px-6 rounded-xl text-lg"
            onClick={handleDownload}
          >
            Download CV
          </button>
        </div>
      </div>

      {/* Skills and Projects Section */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-8 px-8 md:px-20 py-10"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-2">Skills</h2>
          <ul className="list-disc pl-5 text-gray-300">
            <li>Electronic Circuit Design</li>
            <li>PCB Design (KiCad, Proteus)</li>
            <li>Embedded Systems (Arduino, Raspberry Pi)</li>
            <li>MATLAB, SOLIDWORKS</li>
            <li>Project Management</li>
          </ul>
        </div>
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-2">Highlighted Projects</h2>
          <ul className="list-disc pl-5 text-gray-300">
            <li>Advanced Autonomous Vehicle Safety System</li>
            <li>Smart Car Parking System</li>
            <li>Automatic Headlight Control</li>
            <li>RLC Meter</li>
          </ul>
        </div>
      </motion.div>

      {/* Contact Section */}
      <motion.div
        className="text-center py-20 bg-gray-800 px-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <h2 className="text-3xl font-bold mb-4">Contact Me</h2>
        <p className="text-gray-300 text-lg">Email: gaurawasachintha@gmail.com</p>
        <div className="flex justify-center gap-6 mt-6">
          <a
            href="https://www.linkedin.com/in/sachinthagaurawa/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 text-3xl hover:scale-110"
          >
            <FaLinkedin />
          </a>
        </div>
      </motion.div>

      {/* WhatsApp Floating Button */}
      <a
        href="https://wa.me/94778787998"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-500 p-4 rounded-full shadow-lg z-50 hover:scale-110"
      >
        <FaWhatsapp className="text-white text-3xl" />
      </a>
    </div>
  );
}
