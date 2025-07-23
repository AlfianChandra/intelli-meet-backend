import OpenAI from 'openai';
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
export const transcribe = async (req, res) => {
  const trans = await openai.audio.transcriptions.create({
    file: req.file.buffer,
    model: 'gpt-4o-mini-transcribe',
    stream: true,
  });

  console.log(trans.text)
}