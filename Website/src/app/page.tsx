import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import HowItWorks from "@/components/HowItWorks";
import Services from "@/components/Services";
import WhyBlaid from "@/components/WhyBlaid";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <Stats />
        <HowItWorks />
        <Services />
        <WhyBlaid />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
