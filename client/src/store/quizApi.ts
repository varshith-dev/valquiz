import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Quiz } from '../types/game';

const backendUrl = import.meta.env.VITE_BACKEND_URL || '';

export const quizApi = createApi({
  reducerPath: 'quizApi',
  baseQuery: fetchBaseQuery({ baseUrl: `${backendUrl}/api` }),
  endpoints: (builder) => ({
    generateQuiz: builder.mutation<Quiz, { topic: string; num_questions?: number; difficulty?: string }>({
      query: (body) => ({
        url: '/quiz/generate',
        method: 'POST',
        body,
      }),
    }),
    getQuiz: builder.query<Quiz, string>({
      query: (id) => `/quiz/${id}`,
    }),
    createQuiz: builder.mutation<Quiz, Partial<Quiz>>({
      query: (body) => ({
        url: '/quiz',
        method: 'POST',
        body,
      }),
    }),
    getQuizzes: builder.query<Quiz[], void>({
      query: () => '/quiz',
    }),
  }),
});

export const {
  useGenerateQuizMutation,
  useGetQuizQuery,
  useCreateQuizMutation,
  useGetQuizzesQuery,
} = quizApi;
