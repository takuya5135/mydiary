export interface GooglePhoto {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
}

export const fetchPhotosByDate = async (accessToken: string, dateStr: string): Promise<GooglePhoto[]> => {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split("-").map(Number);

  const url = "https://photoslibrary.googleapis.com/v1/mediaItems:search";
  const body = {
    filters: {
      dateFilter: {
        dates: [
          {
            day,
            month,
            year
          }
        ]
      }
    }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Photos API error:", errorData);
      throw new Error(`Failed to fetch photos: ${response.statusText}`);
    }

    const data = await response.json();
    return data.mediaItems || [];
  } catch (error) {
    console.error("Error in fetchPhotosByDate:", error);
    return [];
  }
};
