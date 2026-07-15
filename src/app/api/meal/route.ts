import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // KST (Korea Standard Time) date formatting
  const kstFormatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = kstFormatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const defaultDate = `${year}${month}${day}`;

  const date = searchParams.get('date') || defaultDate;

  // NEIS API parameters
  const ATPT_OFCDC_SC_CODE = 'C10'; // 부산광역시교육청
  const SD_SCHUL_CODE = '7201262'; // 오션중학교
  
  const neisUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${date}`;

  try {
    const response = await fetch(neisUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache meal info for 1 hour
    });

    if (!response.ok) {
      throw new Error(`NEIS API returned status ${response.status}`);
    }

    const data = await response.json();

    // Check if error message is returned from NEIS or no data
    if (data.RESULT && data.RESULT.CODE === 'INFO-200') {
      return NextResponse.json({
        success: true,
        date,
        meals: [],
        message: '오늘의 급식이 없습니다. 🍕',
      });
    }

    if (!data.mealServiceDietInfo) {
      return NextResponse.json({
        success: true,
        date,
        meals: [],
        message: '급식 정보가 존재하지 않습니다. 🍕',
      });
    }

    const rows = data.mealServiceDietInfo[1].row;
    
    // Process meal records
    const meals = rows.map((row: any) => {
      // Clean up the dish list: remove allergen codes (e.g. "우유(2.)" -> "우유")
      // and split by <br/> to get a clean array
      const rawDish = row.DDISH_NM || '';
      const cleanDish = rawDish
        .replace(/\([^)]*\)/g, '') // remove parentheses and contents (allergens)
        .replace(/\s+/g, ' ')      // clean extra whitespaces
        .trim();
        
      const dishes = cleanDish
        .split(/<br\s*\/?>/gi)     // split by <br> or <br/>
        .map((d: string) => d.trim())
        .filter((d: string) => d.length > 0);

      // Clean up nutrition info
      const rawNtr = row.NTR_INFO || '';
      const nutrition = rawNtr
        .split(/<br\s*\/?>/gi)
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0);

      return {
        mealType: row.MMEAL_SC_NM, // 조식, 중식, 석식
        dishes,
        calories: row.CAL_INFO,
        nutrition,
      };
    });

    return NextResponse.json({
      success: true,
      date,
      meals,
    });
  } catch (error: any) {
    console.error('Error fetching meal info:', error);
    return NextResponse.json(
      {
        success: false,
        message: '급식 정보를 불러오는 중 오류가 발생했습니다.',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
