import type { StudySet } from './types'

export const sampleStudySet: StudySet = {
  title: 'MOSFET fundamentals',
  subject: 'Semiconductor devices',
  summary: 'A compact revision set covering MOS structure, channel formation, threshold voltage and operating regions.',
  flashcards: [
    { question: 'What does MOSFET stand for?', answer: 'Metal-Oxide-Semiconductor Field-Effect Transistor.', explanation: 'The name describes its gate structure and the electric-field control of channel conductivity.', difficulty: 'Easy' },
    { question: 'What is the role of the gate oxide?', answer: 'It electrically insulates the gate from the semiconductor while allowing the gate electric field to influence the channel.', explanation: 'The oxide provides capacitive coupling without requiring direct gate current in ideal operation.', difficulty: 'Medium' },
    { question: 'What is threshold voltage?', answer: 'The gate-to-source voltage at which a strong inversion channel forms under the stated device conditions.', explanation: 'It marks the approximate transition into strong inversion for a conventional enhancement MOSFET.', difficulty: 'Medium' },
    { question: 'What happens when VGS is below threshold in an enhancement NMOS?', answer: 'A strong inversion channel is not formed, so the device is nominally off.', explanation: 'Subthreshold current can still exist; “off” does not mean mathematically zero current.', difficulty: 'Medium' },
    { question: 'What are the two common operating regions of a MOSFET?', answer: 'Triode (linear) region and saturation region, with cutoff describing the off condition.', explanation: 'The region depends on gate overdrive and drain-to-source voltage.', difficulty: 'Easy' },
    { question: 'What condition approximately defines saturation for a long-channel NMOS?', answer: 'VDS ≥ VGS − VTH, assuming VGS is above VTH.', explanation: 'The channel pinches off near the drain when the local channel potential reaches the overdrive voltage.', difficulty: 'Hard' },
  ],
  quiz: [
    { question: 'Which layer provides insulation between the gate and semiconductor?', options: ['Drain diffusion', 'Gate oxide', 'Substrate contact', 'Metal interconnect'], correctAnswer: 1, explanation: 'The gate oxide separates the gate electrode from the semiconductor and forms the gate capacitance.', difficulty: 'Easy' },
    { question: 'For an enhancement NMOS, a strong inversion channel forms when:', options: ['VGS is sufficiently above VTH', 'VDS is always zero', 'VGS is negative', 'The gate is disconnected'], correctAnswer: 0, explanation: 'The gate voltage must exceed the threshold under the relevant body-bias and operating conditions.', difficulty: 'Easy' },
    { question: 'Which statement about the MOSFET off state is most accurate?', options: ['Current is always exactly zero', 'The drain is shorted to source', 'Subthreshold current may still flow', 'The gate oxide disappears'], correctAnswer: 2, explanation: 'Real MOSFETs exhibit subthreshold conduction even when they are considered off.', difficulty: 'Medium' },
    { question: 'For a long-channel NMOS in saturation, the approximate condition is:', options: ['VDS < 0', 'VDS ≥ VGS − VTH', 'VGS = 0', 'VDS = VTH only'], correctAnswer: 1, explanation: 'Saturation begins when the drain-end channel voltage reaches the gate overdrive.', difficulty: 'Hard' },
    { question: 'The gate controls channel conductivity primarily through:', options: ['Magnetic coupling', 'An electric field', 'Mechanical pressure', 'Optical excitation'], correctAnswer: 1, explanation: 'The gate voltage establishes an electric field that modulates carrier concentration in the channel.', difficulty: 'Easy' },
  ],
}
