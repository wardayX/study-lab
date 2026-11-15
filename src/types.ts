export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export interface Flashcard {
  question: string
  answer: string
  explanation: string
  difficulty: Difficulty
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  difficulty: Difficulty
}

export interface StudySet {
  title: string
  subject: string
  summary: string
  flashcards: Flashcard[]
  quiz: QuizQuestion[]
}

export type AppView = 'input' | 'flashcards' | 'quiz' | 'revision'
