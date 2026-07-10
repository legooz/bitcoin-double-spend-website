import katex from 'katex';

interface Props {
  math: string;
  display?: boolean;
}

// Renders a LaTeX string with KaTeX. `display` = centered block equation;
// otherwise inline (used for single symbols like α, T, N in prose).
export function Equation({ math, display = false }: Props) {
  const html = katex.renderToString(math, { displayMode: display, throwOnError: false });
  if (display) {
    return <div className="equation-block" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span className="equation-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
