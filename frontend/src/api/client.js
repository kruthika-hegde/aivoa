import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export const extractFromText = (text) =>
  client.post("/ai/extract", { text }).then((r) => r.data);

export const extractFromPdf = (file) => {
  const form = new FormData();
  form.append("file", file);
  return client
    .post("/ai/extract-pdf", form, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

export const askAssistant = (question, formState) =>
  client.post("/ai/ask", { question, form_state: formState }).then((r) => r.data);

export const saveDeviation = (payload) =>
  client.post("/deviations", payload).then((r) => r.data);

export const updateDeviation = (id, payload) =>
  client.patch(`/deviations/${id}`, payload).then((r) => r.data);

export const listDeviations = () =>
  client.get("/deviations").then((r) => r.data);

export default client;
