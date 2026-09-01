FROM python:3.12-slim

WORKDIR /app

# Сначала копируем только requirements.txt — Docker кэширует этот слой,
# и при изменении только кода (без изменения зависимостей) пересборка будет быстрой
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Теперь копируем весь остальной код
COPY . .

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]