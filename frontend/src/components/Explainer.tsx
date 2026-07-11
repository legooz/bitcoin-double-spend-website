import { EXAMPLE_ALPHA, exampleFast, exampleMempool, exampleNormal } from '../exampleGraphs';
import { Equation } from './Equation';
import { ProbabilityChart } from './ProbabilityChart';

const FORMULA =
  'P_{\\text{double-spend if accepted now}}(T, N) = ' +
  '\\sum_{i=-N}^{0} P_{\\text{attacker ahead by } i}(i, T, N)\\left(\\frac{\\alpha}{1-\\alpha}\\right)^{-i+1}' +
  ' + 1 - \\sum_{i=-N}^{0} P_{\\text{attacker ahead by } i}(i, T, N)';

export function Explainer() {
  return (
    <section className="explainer">
      <div className="explainer-intro">
        <h2>Enter a transaction ID above</h2>
        <p>
          Search any Bitcoin transaction to see its details and the probability of a double-spend
          attack. You can also try a sample, or load a live mempool transaction.
        </p>
      </div>

      <h2>What is a double spend?</h2>
      <p>
        Double spending is using the same coins more than once in separate transactions. In
        cryptocurrencies like Bitcoin it can happen when someone tries to send the same funds to two
        different places before the network has confirmed which transaction is valid. Because digital
        information can be copied, a secure payment system has to prevent the same money from being
        reused. Bitcoin handles this with the blockchain, where transactions are verified and recorded
        by the network, making fraudulent duplicate spending much harder to pull off.
      </p>

      <h2>How Bitcoin defends against it</h2>
      <p>
        In Bitcoin, blocks record the order of transactions, and each new block added on top of a
        transaction makes it harder to reverse. But a transaction's safety depends not only on how
        many confirmations it has, but also on how long those confirmations took. Two transactions can
        have the same number of confirmations, yet the one that took much longer to get them may still
        carry a higher double-spend risk. So transactions should be judged by block confirmations
        <em> and </em> the time since they were broadcast, not by blocks alone.
      </p>
      <p>
        <a href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer">
          Satoshi Nakamoto's paper
        </a>{' '}
        explains that Bitcoin secures transactions by placing them in a chain of timestamped blocks,
        where each additional block makes earlier transactions harder to change.{' '}
        <a href="https://eprint.iacr.org/2018/040" target="_blank" rel="noopener noreferrer">
          Sebastian Neumayer's analysis
        </a>{' '}
        adds that a transaction's security should not be judged by confirmations alone, but also by how
        much time has passed since it was broadcast. In short: Nakamoto describes the blockchain
        structure, and Neumayer explains why time and confirmations together give a truer picture of
        double-spend risk.
      </p>

      <h2>The double-spend probability model</h2>
      <p>The equation below estimates the probability that a transaction could be double spent, where:</p>
      <ul className="var-list">
        <li>
          <Equation math="\alpha" /> is the fraction of network hash power the attacker controls
        </li>
        <li>
          <Equation math="i" /> is the attacker's current lead or gap versus the honest chain
        </li>
        <li>
          <Equation math="T" /> is the time elapsed since the transaction was broadcast
        </li>
        <li>
          <Equation math="N" /> is the number of main-chain blocks added since the broadcast
        </li>
      </ul>

      <Equation display math={FORMULA} />

      <p>
        Intuitively, more confirmations (<Equation math="N" />) lowers the risk, while more elapsed
        time (<Equation math="T" />) at a fixed number of confirmations raises it, which is exactly
        why both matter.
      </p>
      <p>
        The model takes a worst case: the attacker starts on equal footing with the honest chain the
        moment the transaction is broadcast, and mines a competing chain continuously. That makes the
        result an upper bound on risk, not a prediction that an attack will happen.
      </p>

      <h2>Example scenarios (α = {EXAMPLE_ALPHA})</h2>
      <p>
        The same transaction is far riskier the longer it stays unconfirmed, and safer the faster it
        confirms:
      </p>
      <div className="example-graphs">
        <div className="example-graph">
          <div className="graph-card-title">Stuck in the mempool</div>
          <div className="graph-card-subtitle">0 confirmations, so the risk climbs with time.</div>
          <div className="graph-surface">
            <ProbabilityChart points={exampleMempool} color="#ef4444" height={190} />
          </div>
        </div>
        <div className="example-graph">
          <div className="graph-card-title">Normal confirmations</div>
          <div className="graph-card-subtitle">About one block every 10 minutes; the risk decays.</div>
          <div className="graph-surface">
            <ProbabilityChart points={exampleNormal} color="#e89a3d" height={190} />
          </div>
        </div>
        <div className="example-graph">
          <div className="graph-card-title">Fast confirmations</div>
          <div className="graph-card-subtitle">About one block every 3 minutes; the risk collapses fast.</div>
          <div className="graph-surface">
            <ProbabilityChart points={exampleFast} color="#22c55e" height={190} />
          </div>
        </div>
      </div>

      <h3>References</h3>
      <p className="refs">
        S. Nakamoto,{' '}
        <a href="https://bitcoin.org/bitcoin.pdf" target="_blank" rel="noopener noreferrer">
          “Bitcoin: A Peer-to-Peer Electronic Cash System,”
        </a>{' '}
        2008.
        <br />
        S. Neumayer, M. Varia, and I. Eyal,{' '}
        <a href="https://eprint.iacr.org/2018/040" target="_blank" rel="noopener noreferrer">
          “An analysis of acceptance policies for blockchain transactions,”
        </a>{' '}
        IACR Cryptology ePrint Archive, Rep. 2018/040, 2018.
      </p>
    </section>
  );
}
