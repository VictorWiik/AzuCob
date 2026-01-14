import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
});

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.active) {
        res.status(401).json({ error: 'Credenciais inválidas' });
        return;
      }

      const passwordValid = await bcrypt.compare(password, user.password);

      if (!passwordValid) {
        res.status(401).json({ error: 'Credenciais inválidas' });
        return;
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn as string }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name } = registerSchema.parse(req.body);

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        res.status(400).json({ error: 'Email já cadastrado' });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'USER',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn as string }
      );

      res.status(201).json({ token, user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
        return;
      }
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    // req.user já está populado pelo middleware
    res.json({ user: (req as any).user });
  }
}

export const authController = new AuthController();
