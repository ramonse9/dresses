import 'dotenv/config';
import { DataSource } from 'typeorm';
import { createDataSourceOptions } from './database.config.js';

export default new DataSource(createDataSourceOptions());
