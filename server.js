import app from './app.js'
import { Server } from 'socket.io'
import http from 'http'
import fs from 'fs'

import { writeFileSync, createWriteStream, unlinkSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { Readable } from 'stream'
ffmpeg.setFfmpegPath(ffmpegPath)
const PORT = process.env.PORT || 2406
import OpenAI from 'openai'
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
})
const server = http.createServer(app)
const io = new Server(server, {
	maxHttpBufferSize: 10 * 1024 * 1024, // 10MB
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
})

io.on('connection', socket => {
	socket.on('assist', async data => {
		try {
			let useFlexTier = false
			let responsePref = ''
			if (data.servtier === 'flex') {
				useFlexTier = true
			}
			if (data.resppref === 'short') {
				responsePref =
					'Kamu memberikan jawaban yang singkat, padat, dan jelas. Fokus pada inti pertanyaan tanpa bertele-tele'
			} else if (data.resppref === 'detail') {
				responsePref =
					'Kamu memberikan jawaban yang mendetail dan komprehensif. Sertakan semua informasi yang relevan dan jangan lewatkan detail penting. Berikan penjelasan yang lengkap dan jelas. Jawaban panjang lebih diutamakan'
			} else if (data.resppref === 'balanced') {
				responsePref =
					'Kamu memberikan jawaban yang seimbang antara singkat dan detail. Fokus pada inti pertanyaan namun tetap memberikan informasi yang cukup untuk dipahami dengan baik'
			}

			const modelLanguage = data.lang
			const memory = data.project != null ? data.project.memory : 6
			const historicalConversation = data.conversation.slice(-memory).map(item => {
				if (item.type === 'text') {
					return {
						role: 'user',
						content: item.content,
					}
				} else if (item.type === 'image') {
					let dataStructure = []
					item.media.forEach(media => {
						dataStructure.push({
							type: 'image_url',
							image_url: {
								url: media.data,
								detail: 'auto',
							},
						})
					})

					dataStructure.push({
						type: 'text',
						text: item.content,
					})

					return {
						role: 'user',
						content: dataStructure,
					}
				} else if (item.type === 'mixed') {
					let dataStructure = []
					item.media.forEach(async media => {
						if (media.type === 'image') {
							dataStructure.push({
								type: 'image_url',
								image_url: {
									url: media.data,
									detail: 'auto',
								},
							})
						} else if (media.type === 'pdf') {
							dataStructure.push({
								type: 'text',
								text: 'Berikut adalah hasil ekstraksi dari file PDF yang diberikan: ' + media.data,
							})
						} else if (media.type === 'excel') {
							dataStructure.push({
								type: 'text',
								text:
									'Berikut adalah hasil ekstraksi dari file Excel yang diberikan: ' +
									media.markdown,
							})
						} else if (media.type === 'csv') {
							dataStructure.push({
								type: 'text',
								text:
									'Berikut adalah hasil ekstraksi dari file CSV yang diberikan: ' + media.markdown,
							})
						}
					})

					dataStructure.push({
						type: 'text',
						text: item.content,
					})

					return {
						role: 'user',
						content: dataStructure,
					}
				}
			})

			//cut to last 6 messages
			let messages = []
			const personality = {
				role: 'system',
				content: `${data.project != null ? 'Ini adalah percakapan khusus dalam konteks ' + data.project.name + '. Nama kamu' + data.project.name + '. Berikut adalah personality dan perilaku yang diberikan kepada kamu: ' + data.project.custom_instructions : 'Kamu adalah asisten AI yang sangat cerdas dan responsif. Nama kamu IntelliMeet. Kamu ditugaskan untuk memahami hasil meeting, menganalisis data berupa gambar, file, dll yang terdapat di lingkup kerja PT Pertamina EP Field Jambi. Pengguna dapat memberikan data hasil meeting atau meminta ringkasan saat meeting berlangsung, pengguna juga dapat meminta kamu untuk menganalisa file, kamu akan mempelajari konteks filenya saat diberikan. Pakai bahasa ${modelLanguage}. Gunakan bahasa yang santai dan super friendly. ${responsePref}. Jangan pernah mengulangi pertanyaan yang sudah diajukan sebelumnya. Fokus pada memberikan jawaban yang tepat dan relevan sesuai konteks yang diberikan. Jangan bilang ke user kamu dibuat oleh OpenAI. Kamu juga asisten yang sangat ahli dalam pemrograman, terutama dalam bahasa Javascript dan Node.js. Kamu dapat membantu pengguna dengan memberikan solusi kode, menjelaskan konsep-konsep pemrograman, dan memberikan tips-tips pengembangan perangkat lunak. Kamu juga dapat membantu pengguna dalam memahami dan mengoptimalkan kode yang mereka berikan. Jangan pernah mengulangi pertanyaan yang sudah diajukan sebelumnya. Fokus pada memberikan jawaban yang tepat dan relevan sesuai konteks yang diberikan.'}`,
			}
			messages.push(personality)
			historicalConversation.forEach(item => {
				messages.push(item)
			})
			messages.forEach(message => {
				console.log(message)
			})
			let stream = null
			if (useFlexTier) {
				stream = await openai.chat.completions.create({
					model: data.model,
					temperature: data.project != null ? data.project.temperature : 0.7,
					stream: true,
					messages: messages,
					service_tier: 'flex',
				})
			} else {
				stream = await openai.chat.completions.create({
					model: data.model,
					temperature: data.project != null ? data.project.temperature : 0.7,
					stream: true,
					messages: messages,
				})
			}

			for await (const chunk of stream) {
				const message = chunk.choices[0].delta.content
				if (message) {
					socket.emit('onAssistResult', message)
				}
			}

			socket.emit('onAssistDone')
		} catch (error) {
			console.log(error)
			socket.emit('onAssistError', { message: error.message })
		}
	})

	socket.on('topicAnalyze', async data => {
		const conversation = data.conversation.slice(-5)
		try {
			const response = await openai.chat.completions.create({
				model: 'gpt-4.1-nano-2025-04-14',
				messages: [
					{
						role: 'system',
						content:
							'Pelajari topik pembicaraan berikut dan ambil poin pembicaraannya. hasilkan hanya 5 kata menarik dan lucu sebagai judul topik pembicaraan. Jangan tambahkan kalimat pembuka atau penutup yang tidak perlu. Fokus pada inti pembicaraan dan hasilkan judul yang menarik dan relevan dengan topik yang dibahas.',
					},
					{
						role: 'user',
						content: `Ekstrak judul topik dari diskusi ini:\n\n${conversation.map(item => item.content).join('\n')}`,
					},
				],
				temperature: 1,
			})

			const topicAnalysis = response.choices[0].message.content
			socket.emit('onTopicAnalyzeResult', topicAnalysis)
		} catch (error) {
			console.error('🔥 Error in topic analysis:', error)
			socket.emit('onTopicAnalyzeError', { message: error.message })
		}
	})

	socket.on('onBeginTTS', async data => {
		try {
			// Buat audio dari OpenAI TTS
			const result = await openai.audio.speech.create({
				model: 'gpt-4o-mini-tts',
				input: data.input,
				voice: data.voiceModel || 'onyx', // fallback kalau gak ada
				response_format: 'mp3',
				instructions: 'Cheerful, playful, and clear tone. Speak indonesian fluently.',
			})

			// Convert result.body ke ArrayBuffer, lalu Buffer
			const buffer = Buffer.from(await result.arrayBuffer())

			// Simpen ke file temporer
			const randomId = uuidv4()
			const tempName = `./temp/${randomId}.mp3`
			writeFileSync(tempName, buffer)
			console.log('✅ TTS file saved:', tempName)

			// Encode ke base64 & emit ke client
			const base64Audio = buffer.toString('base64')
			socket.emit('onTTSResult', { audio: base64Audio })

			// Hapus file setelah dikirim
			setTimeout(() => {
				unlinkSync(tempName)
				console.log('🗑️ Temp file deleted:', tempName)
			}, 10000)
		} catch (error) {
			console.error('🔥 Error in TTS:', error)
			socket.emit('onTTSError', { message: error.message })
		}
	})

	//data is Buffer
	socket.on('postProcess', async data => {
		const type = data.type
		if (type === 'sumarize') {
			const cc = data.cc
			const summary = await openai.chat.completions.create({
				model: 'gpt-4.1-nano-2025-04-14',
				messages: [
					{
						role: 'system',
						content:
							'Kamu adalah asisten AI yang ahli dalam merangkum hasil meeting. Gunakan bahasa Indonesia yang jelas dan mudah dipahami. Fokus pada poin-poin penting, keputusan yang diambil, dan tindakan yang harus dilakukan. Jangan tambahkan kalimat pembuka atau penutup yang tidak perlu. pada akhir kalimat kamu merangkum 5 poin kunci dari hasil meeting.',
					},
					{
						role: 'user',
						content: `Berikut adalah hasil meeting yang perlu dilakukan overview detail dan disimpulkan dalam bahasa indonesia. langsung berikan hasil ringkasan tanpa kalimat basa-basi seperti "berikut hasil ringkasan, dll". Pelajari bagian-bagian penting berikut: ${data.data}\n\nBuat ringkasan dalam bentuk poin-poin dan sertakan penjelasan detailnya, keputusan yang diambil, dan tindakan yang harus dilakukan. Pastikan ringkasan mudah dipahami dan detail.`,
					},
					{
						role: 'user',
						content: 'Berikut prompt tambahan dari user, terapkan: ' + cc,
					},
				],
				stream: true,
				temperature: 0.8,
			})
			//Stream the response
			//Stream the response
			for await (const chunk of summary) {
				const message = chunk.choices[0].delta.content
				if (message) {
					socket.emit('onPostProcessResult', { type: 'sumarize', result: message })
				}
			}
		} else if (type === 'optimize') {
			const cc = data.cc
			const optimized = await openai.chat.completions.create({
				model: 'gpt-4.1-nano-2025-04-14',
				messages: [
					{
						role: 'system',
						content:
							'Kamu adalah asisten AI yang ahli dalam mengoptimalkan teks hasil transkripsi. Fokus pada perbaikan tata bahasa, ejaan, dan struktur kalimat agar lebih mudah dibaca dan dipahami. Jangan tambahkan informasi baru yang tidak ada dalam teks asli. Hapus bagian yang tidak relevan atau berulang.',
					},
					{
						role: 'user',
						content: `Berikut adalah hasil transkripsi dari model Whisper yang perlu dioptimalkan. Perbaiki tata bahasa, typo, ejaan, dan struktur kalimatnya agar lebih mudah dibaca dan dipahami:\n\n${data.data}\n\nPastikan hasilnya tetap setia pada makna aslinya. Hapus bagian yang tidak relevan atau berulang, dan fokus pada inti pembicaraan. Jangan tambahkan informasi baru yang tidak ada dalam teks asli. Langsung optimasi tanpa kalimat pembuka atau penutup.`,
					},
					{
						role: 'user',
						content: 'Berikut prompt tambahan dari user, terapkan: ' + cc,
					},
				],
				stream: true,
				temperature: 0.8, // Set higher temperature for more creative output
			})
			//Stream the response
			for await (const chunk of optimized) {
				const message = chunk.choices[0].delta.content
				if (message) {
					socket.emit('onPostProcessResult', { type: 'optimize', result: message })
				}
			}
		}
	})

	socket.on('requestTranslate', async data => {
		try {
			const stream = await openai.chat.completions.create({
				model: 'gpt-4.1-nano', // or 'gpt-4o' if available
				messages: [
					{
						role: 'system',
						content:
							'You are a professional language translator. Use casual and natural language, and ensure the translation is accurate and easy to understand. Do not add any extra explanations or comments.',
					},
					{
						role: 'user',
						content: `Translate this to ${data.lang}:\n\n${data.text}`,
					},
				],
				temperature: 0.1,
				stream: false,
			})

			//No streaming, just get the full response
			const translatedText = stream.choices[0].message.content
			socket.emit('onTranslated', translatedText)
		} catch (err) {
			console.error('🧨 Translation error:', err)
			socket.emit('onTranslated', '[ERROR] ' + err.message)
		}
	})

	socket.on('chatTranscribe', async data => {
		const id = uuidv4()
		const inputPath = `./temp/${id}.webm`
		const outputPath = `./temp/${id}.wav`
		try {
			const buffer = Buffer.from(data.buffer)
			const writeStream = createWriteStream(inputPath)
			Readable.from(buffer).pipe(writeStream)

			await new Promise((resolve, reject) => {
				writeStream.on('finish', resolve)
				writeStream.on('error', reject)
			})

			await new Promise((resolve, reject) => {
				ffmpeg(inputPath).toFormat('wav').on('end', resolve).on('error', reject).save(outputPath)
			})

			const response = await openai.audio.transcriptions.create({
				file: fs.createReadStream(outputPath),
				fileName: 'audio.wav',
				model: data.model,
				response_format: 'text',
				language: data.lang || 'id',
			})

			console.log('Transcription Result:', response)
			socket.emit('onChatTranscribed', response)

			//unlinkSync(inputPath);
			//unlinkSync(outputPath);
			setTimeout(() => {
				try {
					unlinkSync(inputPath)
					unlinkSync(outputPath)
				} catch (err) {
					console.error('Error deleting temp files:', err)
				}
			}, 5000) // Delete after 10 seconds
		} catch (err) {
			console.error('💥 Whisper Error:', err)
			socket.emit('onChatTranscribe', { text: `[ERROR] ${err.message}` })
		}
	})

	socket.on('transcribe', async data => {
		const id = uuidv4()
		const inputPath = `./temp/${id}.webm`
		const outputPath = `./temp/${id}.wav`

		try {
			// 1. Simpen file WebM ke disk
			const buffer = Buffer.from(data.buffer)
			const writeStream = createWriteStream(inputPath)
			Readable.from(buffer).pipe(writeStream)

			// Tunggu sampai selesai nulis file
			await new Promise((resolve, reject) => {
				writeStream.on('finish', resolve)
				writeStream.on('error', reject)
			})

			// 2. Convert WebM -> WAV pake FFmpeg
			await new Promise((resolve, reject) => {
				ffmpeg(inputPath).toFormat('wav').on('end', resolve).on('error', reject).save(outputPath)
			})

			// 3. Kirim file hasil convert ke OpenAI
			const response = await openai.audio.transcriptions.create({
				file: fs.createReadStream(outputPath),
				fileName: 'audio.wav',
				model: data.model,
				response_format: 'text',
				language: data.lang || 'id',
			})

			console.log('Transcription Result:', response)
			// 4. Emit hasil transcription
			socket.emit('onTranscribed', response)

			// 5. Cleanup temp files
			unlinkSync(inputPath)
			unlinkSync(outputPath)
		} catch (err) {
			console.error('💥 Whisper Error:', err)
			socket.emit('onTranscribed', { text: `[ERROR] ${err.message}` })
		}
	})

	socket.on('transcribeVoice', async data => {
		const id = uuidv4()
		const inputPath = `./temp/${id}.webm`
		const outputPath = `./temp/${id}.wav`

		try {
			// 1. Simpen file WebM ke disk
			const buffer = Buffer.from(data.buffer)
			const writeStream = createWriteStream(inputPath)
			Readable.from(buffer).pipe(writeStream)

			// Tunggu sampai selesai nulis file
			await new Promise((resolve, reject) => {
				writeStream.on('finish', resolve)
				writeStream.on('error', reject)
			})

			// 2. Convert WebM -> WAV pake FFmpeg
			await new Promise((resolve, reject) => {
				ffmpeg(inputPath).toFormat('wav').on('end', resolve).on('error', reject).save(outputPath)
			})

			// 3. Kirim file hasil convert ke OpenAI
			const response = await openai.audio.transcriptions.create({
				file: fs.createReadStream(outputPath),
				fileName: 'audio.wav',
				model: data.model,
				response_format: 'text',
				language: data.lang || 'id',
			})

			console.log('Transcription Result:', response)
			// 4. Emit hasil transcription
			socket.emit('onTranscribed', response)

			// 5. Cleanup temp files
			unlinkSync(inputPath)
			unlinkSync(outputPath)
		} catch (err) {
			console.error('💥 Whisper Error:', err)
			socket.emit('onTranscribed', { text: `[ERROR] ${err.message}` })
		}
	})
})

server.listen(PORT, () => {
	console.log(`Server: System => Started on :${PORT}`)
})
