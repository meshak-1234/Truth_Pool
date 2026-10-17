
import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "bluff_or_believe"),
}

try:
    connection = mysql.connector.connect(**config)

    if connection.is_connected():
        print("SUCCESS: Connected to MySQL!")
        print("Database:", config["database"])

        cursor = connection.cursor()
        cursor.execute("SHOW TABLES")

        print("Tables:")
        for table in cursor.fetchall():
            print("-", table[0])

        cursor.close()
        connection.close()

except mysql.connector.Error as error:
    print("MySQL connection failed.")
    print("Error:", error)
