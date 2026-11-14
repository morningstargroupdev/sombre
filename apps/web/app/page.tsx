import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { History } from "@/components/history";
import { Schema } from "@/components/schema";
import { Statement } from "@/components/statement";
import { Steps } from "@/components/steps";

const Home = () => (
  <main id="main" tabIndex={-1}>
    <Schema />
    <Hero />
    <Steps />
    <History />
    <Statement />
    <Features />
    <Faq />
  </main>
);

export default Home;
