import { graph, script } from "@/lib/meta";

export const Schema = () => (
  <script type="application/ld+json">{script(graph())}</script>
);
