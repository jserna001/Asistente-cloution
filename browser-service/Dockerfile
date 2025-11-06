# Usar la imagen oficial que incluye navegadores y dependencias
FROM mcr.microsoft.com/playwright:v1.56.1-noble

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar el package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto que usará nuestro servidor (ej. 3001)
EXPOSE 3001

# Comando para iniciar el servidor
CMD ["npm", "start"]