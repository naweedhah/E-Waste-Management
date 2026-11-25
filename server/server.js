import dotenv from 'dotenv';
import connectDB from './config/db.js';
import { createApp } from './app.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

await connectDB();
const app = await createApp();

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔎 GraphQL endpoint on http://localhost:${PORT}/graphql`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});
