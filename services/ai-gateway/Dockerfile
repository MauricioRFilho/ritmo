FROM python:3.12-slim
WORKDIR /app
COPY services/ai-gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/ai-gateway/app ./app
COPY modelos ./modelos
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
