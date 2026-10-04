import 'dotenv/config'
import cors from 'cors'
import express from 'express'

const app = express()
const port = Number(process.env.PORT ?? 4000)

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json())

// Product routes and business logic will be introduced in later phases.
app.listen(port, () => console.info(`Carpooling service foundation listening on port ${port}`))
