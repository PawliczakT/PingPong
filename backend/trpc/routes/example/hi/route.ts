import { z } from 'zod';
import { publicProcedure } from '../../../app-router';

export const hiProcedure = publicProcedure
  .input(
    z.object({
      name: z.string().optional(),
    })
  )
  .query(({ input }) => {
    return {
      greeting: `Hello ${input.name || 'World'}!`,
      date: new Date(),
    };
  });