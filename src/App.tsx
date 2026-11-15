import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import './App.css'
import { sampleStudySet } from './sample'
import type { AppView, StudySet } from './types'

type GenerateResponse = { data?: StudySet; error?: string }

function validateStudySet(value: unknown): value is StudySet {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (typeof data.title !== 'string' || typeof data.subject !== 'string' || typeof data.summary !== 'string') return false
  if (!Array.isArray(data.flashcards) || data.flashcards.length < 4 || data.flashcards.length > 12 || !Array.isArray(data.quiz) || data.quiz.length < 4 || data.quiz.length > 8) return false
  const cardsOk = data.flashcards.every((item) => {
    if (!item || typeof item !== 'object') return false
    const card = item as Record<string, unknown>
    return typeof card.question === 'string' && card.question.length >= 8 && typeof card.answer === 'string' && card.answer.length > 2 && typeof card.explanation === 'string' && card.explanation.length > 2 && ['Easy', 'Medium', 'Hard'].includes(String(card.difficulty))
  })
  const quizOk = data.quiz.every((item) => {
    if (!item || typeof item !== 'object') return false
    const question = item as Record<string, unknown>
    return typeof question.question === 'string' && question.question.length >= 8 && Array.isArray(question.options) && question.options.length === 4 && question.options.every(option => typeof option === 'string' && option.length > 0) && Number.isInteger(question.correctAnswer) && Number(question.correctAnswer) >= 0 && Number(question.correctAnswer) <= 3 && typeof question.explanation === 'string' && question.explanation.length > 2 && ['Easy', 'Medium', 'Hard'].includes(String(question.difficulty))
  })
  return cardsOk && quizOk
}

function App() {
  const [notes, setNotes] = useState('')
  const [studySet, setStudySet] = useState<StudySet | null>(null)
  const [view, setView] = useState<AppView>('input')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [cardIndex, setCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [knownCards, setKnownCards] = useState<number[]>([])
  const [wrongCards, setWrongCards] = useState<number[]>([])
  const [quizIndex, setQuizIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [showExplanation, setShowExplanation] = useState(false)
  const requestSequenceRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)
  const [wrongQuizQuestions, setWrongQuizQuestions] = useState<number[]>([])
  const [activeQuizIndices, setActiveQuizIndices] = useState<number[] | null>(null)
  const heroRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('.reveal', { y: 22, opacity: 0, duration: 0.75, stagger: 0.09, ease: 'power3.out' })
      gsap.from('.hero-mark', { scale: 0.88, opacity: 0, duration: 0.9, ease: 'back.out(1.5)' })
    }, heroRef)
    return () => ctx.revert()
  }, [])

  const currentCard = studySet?.flashcards[cardIndex]
  const quizIndices = useMemo(() => studySet ? (activeQuizIndices ?? studySet.quiz.map((_, index) => index)) : [], [studySet, activeQuizIndices])
  const currentQuestionIndex = quizIndices[quizIndex]
  const currentQuestion = studySet?.quiz[currentQuestionIndex]
  const score = useMemo(() => quizIndices.reduce((total, index) => total + (studySet?.quiz[index]?.correctAnswer === answers[index] ? 1 : 0), 0), [answers, studySet, quizIndices])
  const quizComplete = Boolean(studySet && Object.keys(answers).length === quizIndices.length && !showExplanation)

  async function generate() {
    if (notes.trim().length < 20) {
      setError('Add at least 20 characters so the model has enough material to work with.')
      return
    }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const activeRequest = ++requestSequenceRef.current
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
        signal: controller.signal,
      })
      const payload = await response.json() as GenerateResponse
      if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
      if (activeRequest !== requestSequenceRef.current) return
      if (!validateStudySet(payload.data)) throw new Error('The AI response did not match the expected study-set structure. Please retry.')
      setStudySet(payload.data)
      resetSession()
      setView('flashcards')
    } catch (caught) {
      if (activeRequest !== requestSequenceRef.current || (caught instanceof Error && caught.name === 'AbortError')) return
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      if (activeRequest === requestSequenceRef.current) setIsLoading(false)
    }
  }

  function resetSession() {
    setCardIndex(0)
    setIsFlipped(false)
    setKnownCards([])
    setWrongCards([])
    setQuizIndex(0)
    setAnswers({})
    setShowExplanation(false)
    setWrongQuizQuestions([])
    setActiveQuizIndices(null)
  }

  function loadDemo() {
    requestSequenceRef.current += 1
    controllerRef.current?.abort()
    setIsLoading(false)
    setStudySet(sampleStudySet)
    resetSession()
    setError('')
    setView('flashcards')
  }

  function markCard(known: boolean) {
    if (known) {
      setKnownCards(previous => previous.includes(cardIndex) ? previous : [...previous, cardIndex])
      setWrongCards(previous => previous.filter(index => index !== cardIndex))
    } else {
      setWrongCards(previous => previous.includes(cardIndex) ? previous : [...previous, cardIndex])
      setKnownCards(previous => previous.filter(index => index !== cardIndex))
    }
    if (studySet && cardIndex < studySet.flashcards.length - 1) {
      setCardIndex(index => index + 1)
      setIsFlipped(false)
    }
  }

  function chooseAnswer(optionIndex: number) {
    if (answers[currentQuestionIndex] !== undefined) return
    setAnswers(previous => ({ ...previous, [currentQuestionIndex]: optionIndex }))
    setShowExplanation(true)
    if (currentQuestion && optionIndex !== currentQuestion.correctAnswer) {
      setWrongQuizQuestions(previous => previous.includes(currentQuestionIndex) ? previous : [...previous, currentQuestionIndex])
    } else {
      setWrongQuizQuestions(previous => previous.filter(index => index !== currentQuestionIndex))
    }
  }

  function restartQuiz() {
    setActiveQuizIndices(null)
    setQuizIndex(0)
    setAnswers({})
    setShowExplanation(false)
  }

  function retryWrongQuiz() {
    if (!wrongQuizQuestions.length) return
    setActiveQuizIndices([...wrongQuizQuestions])
    setQuizIndex(0)
    setAnswers({})
    setShowExplanation(false)
    setView('quiz')
  }

  const navItems: { id: AppView; label: string; number: string; disabled?: boolean }[] = [
    { id: 'input', label: 'SOURCE', number: '01' },
    { id: 'flashcards', label: 'CARDS', number: '02', disabled: !studySet },
    { id: 'quiz', label: 'ASSESS', number: '03', disabled: !studySet },
    { id: 'revision', label: 'REVISIT', number: '04', disabled: !studySet },
  ]

  return (
    <main className="app-shell" ref={heroRef}>
      <header className="topbar">
        <a className="wordmark" href="#top" onClick={() => setView('input')} aria-label="Study Lab home">STUDY<span>//</span>LAB</a>
        <div className="topbar-center"><span className="status-dot" /> AN EXPERIMENT IN STRUCTURED LEARNING</div>
        <div className="topbar-index">N° 001 <span>—</span> 2026</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow reveal"><span>LEARNING SYSTEM</span><span>BUILT FOR CURIOSITY</span></p>
          <h1 className="hero-title reveal">Turn information<br />into <em>understanding.</em></h1>
          <p className="hero-description reveal">A small learning instrument that transforms your notes into active recall. Generate. Practice. Revisit what matters.</p>
        </div>
        <div className="hero-mark" aria-hidden="true"><div className="hero-orbit orbit-a"/><div className="hero-orbit orbit-b"/><div className="hero-orbit orbit-c"/><div className="hero-core"><span>✳</span><small>KNOWLEDGE<br/>ENGINE</small></div><i className="orbit-node node-a"/><i className="orbit-node node-b"/><b className="hero-coordinate"></b></div>
      </section>

      <div className="rule"><span>THE WORKSPACE</span><span>INPUT → RECALL → RETENTION</span></div>

      <section className="workspace">
        <aside className="sidebar">
          <p className="sidebar-label">WORKFLOW / 04</p>
          <nav className="workflow-nav" aria-label="Study workflow">
            {navItems.map(item => (
              <button key={item.id} className={`nav-step ${view === item.id ? 'active' : ''}`} disabled={item.disabled} onClick={() => setView(item.id)}>
                <span className="step-number">{item.number}</span><span>{item.label}</span><span className="step-arrow">↗</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-note"><span className="tiny-cross">✳</span><p>Good learning is not about reading more. It's about remembering better.</p></div>
          <div className="sidebar-foot"><span>STUDY//LAB</span><span>V. 1.0.0</span></div>
        </aside>

        <section className="main-panel" aria-live="polite">
          {view === 'input' && (
            <div className="panel-content input-view">
              <div className="section-heading"><div><p className="eyebrow">01 — SOURCE MATERIAL</p><h2>Start with<br /><em>what you know.</em></h2></div><span className="heading-index">[ INPUT ]</span></div>
              <label className="field-label" htmlFor="study-notes">PASTE NOTES OR ENTER A TOPIC <span>MIN. 20 CHARACTERS</span></label>
              <textarea id="study-notes" value={notes} onChange={event => { setNotes(event.target.value); if (error) setError('') }} placeholder={'Paste lecture notes, a textbook excerpt, or a topic you want to understand.\n\nFor example: Explain the operating regions of an enhancement-mode MOSFET...'} maxLength={20000} />
              <div className="input-meta"><span>{notes.length.toLocaleString()} / 20,000 CHARACTERS</span><span>YOUR MATERIAL STAYS YOURS</span></div>
              {error && <div className="error-box" role="alert"><span>!</span><p>{error}</p><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
              <div className="input-actions"><button className="primary-button" onClick={generate} disabled={isLoading || notes.trim().length < 20}>{isLoading ? <><span className="spinner" /> BUILDING YOUR STUDY SET</> : <>GENERATE STUDY SET <span>↗</span></>}</button><button className="text-button" onClick={loadDemo}>LOAD DEMO <span>↗</span></button></div>
              <p className="fine-print">AI-GENERATED MATERIAL CAN CONTAIN ERRORS. VERIFY IMPORTANT FACTS AGAINST YOUR SOURCE.</p>
            </div>
          )}

          {view === 'flashcards' && studySet && currentCard && (
            <div className="panel-content study-view">
              <div className="section-heading compact"><div><p className="eyebrow">02 — ACTIVE RECALL / {studySet.subject.toUpperCase()}</p><h2>Knowledge, <em>in motion.</em></h2></div><span className="heading-index">[ CARDS ]</span></div>
              <div className="study-summary"><strong>{studySet.title}</strong><span>{studySet.flashcards.length} CARDS · {knownCards.length} KNOWN</span></div>
              <div className="progress-track"><span style={{ width: `${((cardIndex + 1) / studySet.flashcards.length) * 100}%` }} /></div>
              <button className={`flashcard ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(value => !value)} aria-label="Flip flashcard">
                <span className="card-topline"><span>{isFlipped ? 'THE ANSWER' : 'THE QUESTION'}</span><span>{String(cardIndex + 1).padStart(2, '0')} / {String(studySet.flashcards.length).padStart(2, '0')}</span></span>
                <span className="card-main">{isFlipped ? currentCard.answer : currentCard.question}</span>
                {isFlipped && <span className="card-explanation">{currentCard.explanation}</span>}
                <span className="card-bottomline"><span className={`difficulty ${currentCard.difficulty.toLowerCase()}`}>{currentCard.difficulty}</span><span>CLICK TO {isFlipped ? 'SEE QUESTION' : 'REVEAL ANSWER'} ↗</span></span>
              </button>
              <div className="card-controls"><button className="secondary-button" onClick={() => { setCardIndex(index => Math.max(0, index - 1)); setIsFlipped(false) }} disabled={cardIndex === 0}>← PREVIOUS</button><div className="know-actions"><button className="know-button" onClick={() => markCard(false)}>NEED PRACTICE</button><button className="know-button solid" onClick={() => markCard(true)}>I KNOW THIS ↗</button></div><button className="secondary-button next-button" onClick={() => { setCardIndex(index => Math.min(studySet.flashcards.length - 1, index + 1)); setIsFlipped(false) }} disabled={cardIndex === studySet.flashcards.length - 1}>NEXT →</button></div>
              {cardIndex === studySet.flashcards.length - 1 && <p className="completion-note">END OF DECK — MOVE TO ASSESS TO TEST YOUR RECALL.</p>}
            </div>
          )}

          {view === 'quiz' && studySet && currentQuestion && (
            <div className="panel-content study-view">
              <div className="section-heading compact"><div><p className="eyebrow">03 — KNOWLEDGE CHECK / {studySet.subject.toUpperCase()}</p><h2>Test your <em>understanding.</em></h2></div><span className="heading-index">[ QUIZ ]</span></div>
              <div className="study-summary"><strong>{studySet.title}</strong><span>{quizComplete ? 'COMPLETED' : `QUESTION ${quizIndex + 1} / ${quizIndices.length}`}</span></div>
              <div className="progress-track"><span style={{ width: `${(Object.keys(answers).length / quizIndices.length) * 100}%` }} /></div>
              {quizComplete ? (
                <div className="result-panel"><p className="eyebrow">SESSION COMPLETE</p><div className="score-number">{score}<span>/{quizIndices.length}</span></div><h3>{score === quizIndices.length ? 'A clean sweep.' : score >= quizIndices.length / 2 ? 'Good progress.' : 'Room to improve.'}</h3><p>You answered {score} out of {quizIndices.length} questions correctly. Revisit the concepts you missed.</p><div className="result-actions"><button className="primary-button" onClick={restartQuiz}>RETAKE FULL QUIZ ↗</button>{wrongQuizQuestions.length > 0 && <button className="secondary-button" onClick={retryWrongQuiz}>RETEST {wrongQuizQuestions.length} MISSED ↗</button>}</div></div>
              ) : (
                <div className="quiz-block"><div className="quiz-question"><span className="question-number">Q{String(quizIndex + 1).padStart(2, '0')}</span><h3>{currentQuestion.question}</h3></div><div className="options-list">{currentQuestion.options.map((option, index) => { const selected = answers[currentQuestionIndex] === index; const correct = currentQuestion.correctAnswer === index; return <button key={`${currentQuestionIndex}-${index}`} className={`option ${answers[currentQuestionIndex] !== undefined && correct ? 'correct' : ''} ${selected && !correct ? 'incorrect' : ''}`} onClick={() => chooseAnswer(index)} disabled={answers[currentQuestionIndex] !== undefined}><span>{String.fromCharCode(65 + index)}</span>{option}<i>{answers[currentQuestionIndex] !== undefined && correct ? '✓' : selected ? '×' : '↗'}</i></button> })}</div>
                  {showExplanation && <div className="explanation-box"><strong>{answers[currentQuestionIndex] === currentQuestion.correctAnswer ? 'CORRECT' : 'NOT QUITE'}</strong><p>{currentQuestion.explanation}</p><button className="text-button" onClick={() => { if (quizIndex < quizIndices.length - 1) setQuizIndex(index => index + 1); setShowExplanation(false) }}>{quizIndex === quizIndices.length - 1 ? 'SEE RESULTS ↗' : 'NEXT QUESTION →'}</button></div>}
                </div>
              )}
            </div>
          )}

          {view === 'revision' && studySet && (
            <div className="panel-content study-view">
              <div className="section-heading compact"><div><p className="eyebrow">04 — TARGETED REVISION</p><h2>Return to the <em>gaps.</em></h2></div><span className="heading-index">[ REVIEW ]</span></div>
              <div className="revision-stats"><div><strong>{wrongCards.length + wrongQuizQuestions.length}</strong><span>NEEDS REVIEW</span></div><div><strong>{knownCards.length}</strong><span>MARKED KNOWN</span></div><div><strong>{studySet.flashcards.length + studySet.quiz.length}</strong><span>TOTAL ITEMS</span></div></div>
              {wrongCards.length > 0 && <div className="revision-list">{wrongCards.map(index => { const card = studySet.flashcards[index]; if (!card) return null; return <details className="revision-item" key={`card-${index}`}><summary><span>F{String(index + 1).padStart(2, '0')}</span><strong>{card.question}</strong><i>＋</i></summary><p>{card.answer}</p><small>{card.explanation}</small></details> })}</div>}
              {wrongQuizQuestions.length > 0 && <div className="revision-list quiz-revision-list"><div className="revision-list-heading"><span>QUIZ QUESTIONS TO REVISIT</span><button className="secondary-button" onClick={retryWrongQuiz}>RETEST MISSED QUESTIONS ↗</button></div>{wrongQuizQuestions.map(index => { const question = studySet.quiz[index]; if (!question) return null; return <details className="revision-item" key={`quiz-${index}`}><summary><span>Q{String(index + 1).padStart(2, '0')}</span><strong>{question.question}</strong><i>＋</i></summary><p>{question.options[question.correctAnswer]}</p><small>{question.explanation}</small></details> })}</div>}
              {wrongCards.length === 0 && wrongQuizQuestions.length === 0 && <div className="empty-revision"><span>✳</span><h3>No gaps recorded yet.</h3><p>Mark a flashcard as “need practice” or miss a quiz question. Those concepts will appear here.</p><button className="secondary-button" onClick={() => setView('flashcards')}>BACK TO FLASHCARDS ↗</button></div>}
              {(wrongCards.length > 0 || wrongQuizQuestions.length > 0) && <button className="text-button clear-revision" onClick={() => { setWrongCards([]); setWrongQuizQuestions([]) }}>CLEAR REVISION LIST ×</button>}
            </div>
          )}

          {!studySet && view !== 'input' && <div className="empty-revision"><span>✳</span><h3>No study set yet.</h3><p>Start with your source material to generate your first learning session.</p><button className="secondary-button" onClick={() => setView('input')}>ADD SOURCE MATERIAL ↗</button></div>}
        </section>
      </section>

      <footer className="footer"><span>STUDY//LAB © 2026</span><span>DESIGNED AS AN EXPERIMENT IN ACTIVE RECALL</span><span>BUILT WITH CURIOSITY ↗</span></footer>
    </main>
  )
}

export default App
