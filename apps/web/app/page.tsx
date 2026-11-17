import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { History } from "@/components/history";
import { Schema } from "@/components/schema";
import { Steps } from "@/components/steps";

const Home = () => (
  <main>
    <Schema />
    <Hero />
    <Steps />
    <History />
    <Features />
    <Faq />
  </main>
);

export default Home;
