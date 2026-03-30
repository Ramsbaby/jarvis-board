export interface LCProblem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  description: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints: string[];
  hint: string;
  starterCode: string;
  modelSolution: string;
  /** 해설 주석이 달린 베스트 풀이 — 풀이 중/후 학습용 */
  annotatedSolution: string;
}

export const LIVE_CODING_PROBLEMS: LCProblem[] = [
  {
    id: 'lc-001',
    title: '거스름돈 최소 화폐',
    difficulty: 'easy',
    tags: ['그리디', '배열'],
    description: `편의점 계산대에서 거스름돈을 줄 때, 최소 개수의 화폐(지폐+동전)로 거슬러 주는 프로그램을 작성하세요.

화폐 종류: 50000, 10000, 5000, 1000, 500, 100, 50, 10원

정수 amount가 주어질 때, 각 화폐 종류별 필요 개수를 Map으로 반환하세요. (개수가 0인 항목은 제외)`,
    examples: [
      {
        input: 'amount = 37860',
        output: '{10000=3, 5000=1, 1000=2, 500=1, 100=3, 50=1, 10=1}',
        explanation: '10000×3 + 5000×1 + 1000×2 + 500×1 + 100×3 + 50×1 + 10×1 = 37860',
      },
      {
        input: 'amount = 50000',
        output: '{50000=1}',
        explanation: '50000원 지폐 1장',
      },
    ],
    constraints: [
      '0 ≤ amount ≤ 1,000,000',
      '10원 단위로만 거슬러줌 (1원, 5원 없음)',
      '화폐 단위: 50000, 10000, 5000, 1000, 500, 100, 50, 10',
    ],
    hint: '화폐를 큰 것부터 순서대로 처리하세요. amount / 화폐단위 = 개수, amount % 화폐단위 = 나머지.',
    starterCode: `import java.util.*;

public class Solution {
    public Map<Integer, Integer> getChange(int amount) {
        int[] coins = {50000, 10000, 5000, 1000, 500, 100, 50, 10};
        Map<Integer, Integer> result = new LinkedHashMap<>();
        // TODO: 각 화폐 단위로 나눈 몫을 result에 저장
        return result;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        System.out.println(sol.getChange(37860)); // {10000=3, 5000=1, ...}
    }
}`,
    modelSolution: `import java.util.*;

public class Solution {
    public Map<Integer, Integer> getChange(int amount) {
        int[] coins = {50000, 10000, 5000, 1000, 500, 100, 50, 10};
        Map<Integer, Integer> result = new LinkedHashMap<>();

        for (int coin : coins) {
            if (amount >= coin) {
                result.put(coin, amount / coin);
                amount %= coin;
            }
        }
        return result;
    }
}`,
    annotatedSolution: `import java.util.*;

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 문제: 거스름돈 최소 화폐
 * 패턴: 그리디 (Greedy)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 💡 핵심 아이디어: 왜 그리디가 성립하는가?
 *    → 우리나라 화폐는 큰 단위가 작은 단위의 배수 관계
 *      (50000 = 10000×5, 10000 = 5000×2, 5000 = 1000×5 ...)
 *    → 배수 관계이면 "큰 단위를 먼저 최대한 쓰는 것"이 항상 최적
 *    → 만약 배수 관계가 아니라면 그리디 불가 (ex: 동전 1,3,4원 → 6원)
 *
 * 시간복잡도: O(k) — k = 화폐 종류 수 (8개 고정 → 사실상 O(1))
 * 공간복잡도: O(k) — 결과 맵 크기
 */
public class Solution {

    public Map<Integer, Integer> getChange(int amount) {
        // 내림차순 정렬: 큰 단위부터 처리해야 최소 개수 보장
        int[] coins = {50000, 10000, 5000, 1000, 500, 100, 50, 10};

        // LinkedHashMap: 삽입 순서 유지 → 결과가 큰 단위부터 출력됨
        // HashMap은 순서 보장 안 됨 → 출력이 뒤죽박죽
        Map<Integer, Integer> result = new LinkedHashMap<>();

        for (int coin : coins) {
            if (amount <= 0) break; // 나머지가 0이면 더 이상 처리 불필요 (조기 종료)

            int count = amount / coin; // 이 단위 화폐를 몇 개 쓸 수 있나?
            if (count > 0) {
                result.put(coin, count);  // 0개인 화폐는 저장하지 않음 (요구사항)
                amount %= coin;           // 이 단위로 처리하고 남은 금액
            }
        }
        return result;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();

        // 37860 → 10000×3(30000) → 5000×1(5000) → 1000×2(2000) → 500×1(500) → 100×3(300) → 50×1(50) → 10×1(10)
        System.out.println(sol.getChange(37860));
        // {10000=3, 5000=1, 1000=2, 500=1, 100=3, 50=1, 10=1}

        System.out.println(sol.getChange(0));      // {} — 빈 맵
        System.out.println(sol.getChange(50000));  // {50000=1}
    }
}`,
  },
  {
    id: 'lc-002',
    title: '문자열 압축 (RLE)',
    difficulty: 'easy',
    tags: ['문자열', '구현'],
    description: `문자열을 런렝스 인코딩(RLE)으로 압축하세요.

연속된 같은 문자가 있을 경우 "문자+개수" 형식으로 압축합니다.
단, 개수가 1인 경우 숫자를 생략합니다.

압축 결과가 원본보다 길다면 원본을 그대로 반환합니다.`,
    examples: [
      { input: 's = "aabcccdddd"', output: '"a2bc3d4"' },
      {
        input: 's = "abcd"',
        output: '"abcd"',
        explanation: 'a1b1c1d1 = 8글자 > 4글자이므로 원본 반환',
      },
      { input: 's = "aaabbbccc"', output: '"a3b3c3"' },
      { input: 's = ""', output: '""' },
    ],
    constraints: [
      '0 ≤ s.length ≤ 10,000',
      's는 소문자 알파벳만 포함',
      '결과가 원본보다 길면 원본 반환',
    ],
    hint: 'StringBuilder를 사용하고, 현재 문자와 이전 문자를 비교하며 count를 관리하세요. 마지막 문자 처리를 잊지 마세요.',
    starterCode: `public class Solution {
    public String compress(String s) {
        if (s.isEmpty()) return s;
        StringBuilder sb = new StringBuilder();
        int count = 1;
        // TODO: 문자 순회하며 연속 문자 개수 세고 압축
        return sb.length() < s.length() ? sb.toString() : s;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        System.out.println(sol.compress("aabcccdddd")); // "a2bc3d4"
        System.out.println(sol.compress("abcd"));       // "abcd"
    }
}`,
    modelSolution: `public class Solution {
    public String compress(String s) {
        if (s.isEmpty()) return s;

        StringBuilder sb = new StringBuilder();
        int count = 1;

        for (int i = 1; i <= s.length(); i++) {
            if (i < s.length() && s.charAt(i) == s.charAt(i - 1)) {
                count++;
            } else {
                sb.append(s.charAt(i - 1));
                if (count > 1) sb.append(count);
                count = 1;
            }
        }

        return sb.length() < s.length() ? sb.toString() : s;
    }
}`,
    annotatedSolution: `/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 문제: 문자열 압축 (Run-Length Encoding)
 * 패턴: 문자열 순회 + 경계 처리
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 💡 핵심 트릭: i를 s.length()까지 (<=) 순회
 *    → i == s.length()일 때 마지막 그룹을 flush하는 효과
 *    → "마지막 문자 처리" 따로 안 해도 됨 → 코드 단순화
 *
 * 💡 왜 String + 연산이 아니라 StringBuilder?
 *    → String은 불변(immutable) → 매번 새 객체 생성 → O(n²)
 *    → StringBuilder는 가변(mutable) → 내부 char[] 재사용 → O(n)
 *    → 면접관이 이 차이를 알고 있는지 반드시 확인함
 *
 * 시간복잡도: O(n)
 * 공간복잡도: O(n) — StringBuilder 버퍼
 */
public class Solution {

    public String compress(String s) {
        // 엣지케이스: 빈 문자열은 바로 반환
        if (s.isEmpty()) return s;

        StringBuilder sb = new StringBuilder();
        int count = 1; // 현재 문자의 연속 개수 (최소 1개)

        // i를 1부터 시작, s.length()까지 포함 (= 한 칸 밖까지)
        // i == s.length()이면 charAt(i)는 없지만 조건문에서 걸러짐 → 마지막 그룹 처리
        for (int i = 1; i <= s.length(); i++) {

            // 이전 문자(i-1)와 현재 문자(i)가 같으면 카운트 증가
            if (i < s.length() && s.charAt(i) == s.charAt(i - 1)) {
                count++;
            } else {
                // 다르거나 끝에 도달 → 이전 그룹을 결과에 추가
                sb.append(s.charAt(i - 1)); // 문자 먼저
                if (count > 1) sb.append(count); // 개수가 1이면 생략
                count = 1; // 카운터 리셋
            }
        }

        // 압축 결과가 원본보다 길면 원본 반환 (압축 의미 없음)
        // ex: "abcd" → "a1b1c1d1" (8글자) > "abcd" (4글자) → 원본 반환
        return sb.length() < s.length() ? sb.toString() : s;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        System.out.println(sol.compress("aabcccdddd")); // "a2bc3d4"
        System.out.println(sol.compress("abcd"));       // "abcd" (압축 효과 없음)
        System.out.println(sol.compress("aaabbbccc")); // "a3b3c3"
        System.out.println(sol.compress(""));           // ""
        System.out.println(sol.compress("a"));          // "a" (단일 문자)
    }
}`,
  },
  {
    id: 'lc-003',
    title: '괄호 유효성 검사',
    difficulty: 'easy',
    tags: ['스택', '문자열'],
    description: `주어진 문자열이 올바른 괄호 조합인지 검사하세요.

괄호 종류: '(', ')', '{', '}', '[', ']'

규칙:
- 열린 괄호는 반드시 같은 종류의 닫힌 괄호로 닫혀야 합니다.
- 열린 괄호는 올바른 순서로 닫혀야 합니다.`,
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
      { input: 's = "([)]"', output: 'false' },
      { input: 's = "{[]}"', output: 'true' },
    ],
    constraints: [
      '1 ≤ s.length ≤ 10,000',
      's는 괄호 문자만 포함',
      '빈 문자열은 유효하지 않음',
    ],
    hint: 'Stack을 사용하세요. 열린 괄호는 push, 닫힌 괄호는 stack.peek()과 매칭 확인 후 pop.',
    starterCode: `import java.util.*;

public class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        // TODO: 열린 괄호 push, 닫힌 괄호는 매칭 확인
        return stack.isEmpty();
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        System.out.println(sol.isValid("()[]{}"));  // true
        System.out.println(sol.isValid("([)]"));    // false
        System.out.println(sol.isValid("{[]}"));    // true
    }
}`,
    modelSolution: `import java.util.*;

public class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        Map<Character, Character> map = Map.of(')', '(', '}', '{', ']', '[');

        for (char c : s.toCharArray()) {
            if (map.containsValue(c)) {
                stack.push(c);
            } else {
                if (stack.isEmpty() || stack.peek() != map.get(c)) return false;
                stack.pop();
            }
        }
        return stack.isEmpty();
    }
}`,
    annotatedSolution: `import java.util.*;

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 문제: 괄호 유효성 검사
 * 패턴: 스택(Stack) — LIFO 특성 활용
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 💡 왜 스택인가?
 *    → 괄호는 "가장 최근에 열린 것"이 "가장 먼저 닫혀야" 함
 *    → 이게 바로 LIFO (Last In, First Out) = 스택의 본질
 *    → "{[()]}" 에서 '(' 가 열리면 ')' 가 가장 먼저 닫혀야 함
 *
 * 💡 Stack vs Deque?
 *    → Java의 Stack 클래스는 레거시 (synchronized → 느림)
 *    → ArrayDeque가 현대적인 대안 (더 빠르고 가벼움)
 *    → 면접에서 ArrayDeque 쓰면 +1점
 *
 * 💡 Map.of() 활용: 닫힌 괄호 → 대응하는 열린 괄호 매핑
 *    → ')' → '(',  '}' → '{',  ']' → '['
 *    → containsValue로 열린 괄호 판별 대신 !containsKey가 더 깔끔
 *
 * 시간복잡도: O(n) — 각 문자를 한 번씩 처리
 * 공간복잡도: O(n) — 최악의 경우 모두 열린 괄호 → 스택에 n개
 */
public class Solution {

    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>(); // Stack 대신 ArrayDeque (더 빠름)

        // 닫힌 괄호 → 대응하는 열린 괄호 매핑
        // Map.of()는 Java 9+ 불변 맵 생성 (간결함)
        Map<Character, Character> closeToOpen = Map.of(
            ')', '(',
            '}', '{',
            ']', '['
        );

        for (char c : s.toCharArray()) {

            if (!closeToOpen.containsKey(c)) {
                // 열린 괄호 ( { [ → 스택에 push
                stack.push(c);
            } else {
                // 닫힌 괄호 ) } ] → 스택 top과 매칭 확인
                if (stack.isEmpty()) return false;          // 닫힌 괄호인데 스택 비어있음 → 즉시 false
                if (stack.peek() != closeToOpen.get(c)) return false; // top이 대응 열린 괄호가 아님
                stack.pop(); // 매칭 성공 → pop
            }
        }

        // 모든 문자 처리 후 스택이 비어있어야 유효
        // 비어있지 않다면 닫히지 않은 열린 괄호가 남아있음
        return stack.isEmpty();
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        System.out.println(sol.isValid("()"));      // true
        System.out.println(sol.isValid("()[]{}"));  // true
        System.out.println(sol.isValid("(]"));      // false — 종류 불일치
        System.out.println(sol.isValid("([)]"));    // false — 순서 불일치
        System.out.println(sol.isValid("{[]}"));    // true
        System.out.println(sol.isValid("("));       // false — 닫히지 않음
        System.out.println(sol.isValid(")"));       // false — 열리지 않고 닫힘
    }
}`,
  },
  {
    id: 'lc-004',
    title: '중복 결제 감지',
    difficulty: 'medium',
    tags: ['HashMap', '시뮬레이션'],
    description: `결제 시스템에서 동일 사용자가 같은 금액을 짧은 시간 내에 중복 결제하는 경우를 탐지해야 합니다.

결제 내역 리스트가 주어집니다. 각 결제는 "userId,amount,timestamp(초)" 형식의 문자열입니다.
동일 userId + amount 조합이 60초 이내에 2회 이상 발생하면 중복으로 판단합니다.

중복 결제로 판단된 userId 목록을 반환하세요. (중복 없이, 알파벳 순)`,
    examples: [
      {
        input: 'payments = ["user1,1000,100", "user1,1000,150", "user2,2000,200", "user1,1000,500"]',
        output: '["user1"]',
        explanation: 'user1이 100초와 150초에 같은 금액 1000원 결제 → 50초 차이로 중복. 500초는 100초 기준 400초 차이라 별도 판단.',
      },
    ],
    constraints: [
      '1 ≤ payments.length ≤ 10,000',
      'timestamp는 증가 순서로 입력됨',
      '같은 사용자의 동일 금액은 마지막 결제 시간 기준으로 갱신',
      '중복 감지 기준: 동일 userId + amount, 60초 이내',
    ],
    hint: 'HashMap<String, Long> lastPayment = new HashMap<>() 에서 key를 "userId_amount"로 조합하세요.',
    starterCode: `import java.util.*;

public class Solution {
    public List<String> detectDuplicate(String[] payments) {
        Map<String, Long> lastTime = new HashMap<>();
        Set<String> duplicates = new HashSet<>();

        for (String p : payments) {
            String[] parts = p.split(",");
            // TODO: userId, amount, timestamp 파싱 후 중복 판단
        }

        List<String> result = new ArrayList<>(duplicates);
        Collections.sort(result);
        return result;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        String[] payments = {"user1,1000,100", "user1,1000,150", "user2,2000,200"};
        System.out.println(sol.detectDuplicate(payments)); // [user1]
    }
}`,
    modelSolution: `import java.util.*;

public class Solution {
    public List<String> detectDuplicate(String[] payments) {
        Map<String, Long> lastTime = new HashMap<>();
        Set<String> duplicates = new HashSet<>();

        for (String p : payments) {
            String[] parts = p.split(",");
            String userId = parts[0];
            String amount = parts[1];
            long timestamp = Long.parseLong(parts[2]);
            String key = userId + "_" + amount;

            if (lastTime.containsKey(key)) {
                if (timestamp - lastTime.get(key) <= 60) {
                    duplicates.add(userId);
                }
            }
            lastTime.put(key, timestamp);
        }

        List<String> result = new ArrayList<>(duplicates);
        Collections.sort(result);
        return result;
    }
}`,
    annotatedSolution: `import java.util.*;

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 문제: 중복 결제 감지
 * 패턴: HashMap — 복합 키 설계 + 시간 윈도우 판단
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 💡 핵심 설계: 복합 키 (Composite Key)
 *    → "동일 userId + 동일 amount" 조합이 기준
 *    → 두 조건을 하나의 키로 합성: "userId_amount"
 *    → ex) "user1_1000", "user2_2000"
 *    → 이 키로 마지막 결제 시각을 추적
 *
 * 💡 Set<String> duplicates: 같은 user가 여러 번 중복 감지돼도
 *    결과에 한 번만 나오도록 Set으로 관리 (자동 중복 제거)
 *
 * 💡 timestamp를 long으로 파싱하는 이유
 *    → int 최대값 약 21억 → timestamp가 매우 클 경우 오버플로우
 *    → 습관적으로 timestamp는 long 사용
 *
 * 시간복잡도: O(n log n) — 순회 O(n) + 정렬 O(k log k)
 * 공간복잡도: O(n) — HashMap, HashSet 크기
 */
public class Solution {

    public List<String> detectDuplicate(String[] payments) {
        // key: "userId_amount" → value: 마지막 결제 timestamp
        Map<String, Long> lastTime = new HashMap<>();

        // 중복 감지된 userId 저장 (Set → 중복 자동 제거)
        Set<String> duplicates = new HashSet<>();

        for (String p : payments) {
            String[] parts = p.split(","); // ["user1", "1000", "150"]
            String userId    = parts[0];   // "user1"
            String amount    = parts[1];   // "1000"
            long   timestamp = Long.parseLong(parts[2]); // long! int 오버플로우 방지

            // 복합 키: userId + amount 조합을 하나의 문자열로
            String key = userId + "_" + amount; // "user1_1000"

            if (lastTime.containsKey(key)) {
                // 이전 결제가 있고, 60초 이내라면 중복
                long gap = timestamp - lastTime.get(key);
                if (gap <= 60) {
                    duplicates.add(userId); // userId만 저장 (amount 불필요)
                }
            }
            // 항상 최신 timestamp로 갱신 (슬라이딩 기준점)
            lastTime.put(key, timestamp);
        }

        // Set → List 변환 후 알파벳 정렬
        List<String> result = new ArrayList<>(duplicates);
        Collections.sort(result);
        return result;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();

        String[] p1 = {"user1,1000,100", "user1,1000,150", "user2,2000,200", "user1,1000,500"};
        System.out.println(sol.detectDuplicate(p1)); // [user1]
        // user1: 100→150 = 50초 차이 → 중복 ✓
        // user1: 150→500 = 350초 차이 → 정상
        // user2: 단일 결제 → 정상

        String[] p2 = {"userA,500,0", "userA,500,61"}; // 정확히 61초 → 정상
        System.out.println(sol.detectDuplicate(p2)); // []
    }
}`,
  },
  {
    id: 'lc-005',
    title: '이상 거래 탐지 (슬라이딩 윈도우)',
    difficulty: 'medium',
    tags: ['슬라이딩 윈도우', '투포인터'],
    description: `카카오페이 이상 거래 탐지 시스템을 구현합니다.

연속된 k개의 거래 금액 합이 threshold를 초과하는 경우, 해당 구간의 시작 인덱스를 모두 반환하세요.

int[] transactions, int k, int threshold 가 주어집니다.`,
    examples: [
      {
        input: 'transactions = [100, 200, 300, 400, 500, 100], k = 3, threshold = 800',
        output: '[1, 2, 3]',
        explanation: '[200,300,400]=900>800, [300,400,500]=1200>800, [400,500,100]=1000>800',
      },
      {
        input: 'transactions = [100, 100, 100], k = 2, threshold = 300',
        output: '[]',
        explanation: '모든 구간 합 ≤ 300',
      },
    ],
    constraints: [
      '1 ≤ transactions.length ≤ 100,000',
      '1 ≤ k ≤ transactions.length',
      '각 거래 금액 > 0',
      'O(n) 시간 복잡도로 풀어야 함',
    ],
    hint: '첫 k개의 합을 구한 후, 슬라이딩 윈도우로 이전 첫 원소를 빼고 새 원소를 더하세요. O(n) 가능.',
    starterCode: `import java.util.*;

public class Solution {
    public List<Integer> detectAbnormal(int[] transactions, int k, int threshold) {
        List<Integer> result = new ArrayList<>();
        long windowSum = 0;

        // TODO: 첫 번째 윈도우 합 계산
        // TODO: 슬라이딩 윈도우로 나머지 구간 처리
        return result;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        int[] tx = {100, 200, 300, 400, 500, 100};
        System.out.println(sol.detectAbnormal(tx, 3, 800)); // [1, 2, 3]
    }
}`,
    modelSolution: `import java.util.*;

public class Solution {
    public List<Integer> detectAbnormal(int[] transactions, int k, int threshold) {
        List<Integer> result = new ArrayList<>();
        long windowSum = 0;

        for (int i = 0; i < k; i++) windowSum += transactions[i];
        if (windowSum > threshold) result.add(0);

        for (int i = k; i < transactions.length; i++) {
            windowSum += transactions[i] - transactions[i - k];
            if (windowSum > threshold) result.add(i - k + 1);
        }
        return result;
    }
}`,
    annotatedSolution: `import java.util.*;

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 문제: 이상 거래 탐지 (연속 구간 합)
 * 패턴: 슬라이딩 윈도우 (Sliding Window)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 💡 브루트포스 vs 슬라이딩 윈도우 비교:
 *    브루트포스: 모든 구간을 처음부터 합산 → O(n×k)
 *    슬라이딩: 이전 합에서 "빠진 것 빼고 새 것 더하기" → O(n)
 *
 *    예시: [100, 200, 300, 400, 500], k=3
 *    브루트: 100+200+300, 200+300+400, 300+400+500  (9번 덧셈)
 *    슬라이딩: 600, 600-100+400=900, 900-200+500=1200 (5번만)
 *
 *    n=100,000, k=50,000이면 차이가 엄청남
 *
 * 💡 windowSum을 long으로 선언하는 이유
 *    → int[] 거래 금액이 크면 k개 합이 int 최대값(약 21억) 초과 가능
 *    → 금융 도메인에서 오버플로우는 치명적 버그 → 항상 long
 *
 * 시간복잡도: O(n) — 각 원소를 정확히 2번씩 처리 (추가, 제거)
 * 공간복잡도: O(1) — 결과 리스트 외 추가 공간 없음
 */
public class Solution {

    public List<Integer> detectAbnormal(int[] transactions, int k, int threshold) {
        List<Integer> result = new ArrayList<>();

        // long: 금융 데이터 합산 시 int 오버플로우 방지
        long windowSum = 0;

        // Step 1: 첫 번째 윈도우 [0, k-1] 합 계산
        for (int i = 0; i < k; i++) {
            windowSum += transactions[i];
        }
        if (windowSum > threshold) {
            result.add(0); // 시작 인덱스 0
        }

        // Step 2: 윈도우를 오른쪽으로 한 칸씩 이동
        // i = 새로 들어오는 원소의 인덱스
        for (int i = k; i < transactions.length; i++) {
            // 핵심: 합을 처음부터 다시 계산하지 않음
            // "들어오는 원소 더하기" + "나가는 원소 빼기"
            windowSum += transactions[i];         // 오른쪽 새 원소 추가
            windowSum -= transactions[i - k];     // 왼쪽 빠진 원소 제거

            // 현재 윈도우의 시작 인덱스 = i - k + 1
            if (windowSum > threshold) {
                result.add(i - k + 1);
            }
        }

        return result;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();

        int[] tx1 = {100, 200, 300, 400, 500, 100};
        System.out.println(sol.detectAbnormal(tx1, 3, 800));
        // [1, 2, 3] — 인덱스 1부터 시작하는 구간들이 임계치 초과

        int[] tx2 = {100, 100, 100};
        System.out.println(sol.detectAbnormal(tx2, 2, 300));
        // [] — 최대 합 200, 임계치 300 미만

        // k = 배열 전체 길이인 경우
        int[] tx3 = {1000, 2000, 3000};
        System.out.println(sol.detectAbnormal(tx3, 3, 5000));
        // [0] — 전체 합 6000 > 5000
    }
}`,
  },
  {
    id: 'lc-006',
    title: 'LRU 캐시 구현',
    difficulty: 'medium',
    tags: ['자료구조', 'LinkedHashMap'],
    description: `LRU(Least Recently Used) 캐시를 구현하세요. 이 문제는 카카오 계열 면접에서 자주 출제됩니다.

LRUCache 클래스를 구현합니다:
- LRUCache(int capacity): 최대 용량으로 초기화
- int get(int key): key가 존재하면 값 반환, 없으면 -1
- void put(int key, int value): key-value 삽입. 용량 초과 시 가장 오래 사용되지 않은 항목 제거

get과 put 모두 O(1) 평균 복잡도여야 합니다.`,
    examples: [
      {
        input: `LRUCache cache = new LRUCache(2);
cache.put(1, 1);   // cache: {1=1}
cache.put(2, 2);   // cache: {1=1, 2=2}
cache.get(1);      // return 1, cache: {2=2, 1=1}
cache.put(3, 3);   // evict key 2, cache: {1=1, 3=3}
cache.get(2);      // return -1
cache.get(3);      // return 3`,
        output: '1, -1, 3',
      },
    ],
    constraints: [
      '1 ≤ capacity ≤ 3000',
      '0 ≤ key, value ≤ 10,000',
      'get/put 최대 100,000회 호출',
      'get과 put은 O(1) 평균 복잡도',
    ],
    hint: 'Java의 LinkedHashMap(capacity, 0.75f, true)을 활용하면 accessOrder=true로 LRU 동작을 구현할 수 있습니다. removeEldestEntry를 override하세요.',
    starterCode: `import java.util.*;

public class LRUCache {
    private final int capacity;
    private final LinkedHashMap<Integer, Integer> cache;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        // TODO: accessOrder=true로 LinkedHashMap 초기화, removeEldestEntry override
        this.cache = new LinkedHashMap<>(capacity, 0.75f, true);
    }

    public int get(int key) {
        // TODO: key가 있으면 값 반환, 없으면 -1
        return -1;
    }

    public void put(int key, int value) {
        // TODO: key-value 삽입
    }

    public static void main(String[] args) {
        LRUCache c = new LRUCache(2);
        c.put(1, 1); c.put(2, 2);
        System.out.println(c.get(1)); // 1
        c.put(3, 3);
        System.out.println(c.get(2)); // -1
    }
}`,
    modelSolution: `import java.util.*;

public class LRUCache {
    private final int capacity;
    private final LinkedHashMap<Integer, Integer> cache;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new LinkedHashMap<>(capacity, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
                return size() > capacity;
            }
        };
    }

    public int get(int key) {
        return cache.getOrDefault(key, -1);
    }

    public void put(int key, int value) {
        cache.put(key, value);
    }
}`,
    annotatedSolution: `import java.util.*;

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 문제: LRU 캐시 구현
 * 패턴: LinkedHashMap의 accessOrder 활용
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 💡 LRU란?
 *    Least Recently Used — 가장 오래 사용하지 않은 것 제거
 *    CPU 캐시, 웹 캐시, Redis 등에서 실제로 사용하는 알고리즘
 *
 * 💡 왜 LinkedHashMap인가?
 *    HashMap: O(1) 조회/삽입 → 빠르지만 순서 없음
 *    LinkedList: 순서 유지 → 하지만 조회 O(n)
 *    LinkedHashMap: HashMap + 이중 연결 리스트 = O(1) + 순서 유지!
 *
 * 💡 핵심: LinkedHashMap의 두 가지 순서 모드
 *    accessOrder=false (기본): 삽입 순서 유지 (FIFO)
 *    accessOrder=true  (우리): 접근 순서 유지 → get 하면 맨 뒤로 이동
 *    → 맨 앞 = 가장 오래 사용되지 않은 것 = LRU 대상!
 *
 * 💡 removeEldestEntry override:
 *    LinkedHashMap이 원소 추가할 때마다 이 메서드를 호출
 *    true 반환 → 가장 오래된 entry(head) 자동 제거
 *    size() > capacity → 용량 초과 시 자동 제거
 *
 * 시간복잡도: get O(1), put O(1) — HashMap 기반이므로
 * 공간복잡도: O(capacity)
 */
public class LRUCache {

    private final int capacity;

    // LinkedHashMap(initialCapacity, loadFactor, accessOrder)
    // accessOrder=true → get/put 시 해당 항목이 맨 뒤(최근)로 이동
    // 따라서 맨 앞(head)이 항상 LRU 대상
    private final LinkedHashMap<Integer, Integer> cache;

    public LRUCache(int capacity) {
        this.capacity = capacity;

        // 익명 클래스로 removeEldestEntry 오버라이드
        // 이 한 줄이 LRU 로직의 핵심!
        this.cache = new LinkedHashMap<>(capacity, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
                // size()가 capacity 초과하면 eldest(가장 오래된 것) 자동 제거
                return size() > capacity;
            }
        };
    }

    public int get(int key) {
        // getOrDefault: key 없으면 -1 반환 (Optional 없이 깔끔)
        // 내부적으로 key에 접근 → accessOrder=true이므로 맨 뒤로 이동
        return cache.getOrDefault(key, -1);
    }

    public void put(int key, int value) {
        // 삽입만 하면 됨 — 용량 초과 제거는 removeEldestEntry가 알아서
        cache.put(key, value);
        // key가 이미 있으면 값 업데이트 + 맨 뒤로 이동 (최근 사용)
        // key가 없으면 새로 삽입 + capacity 초과 시 eldest 자동 제거
    }

    public static void main(String[] args) {
        LRUCache cache = new LRUCache(2);

        cache.put(1, 1); // {1=1}
        cache.put(2, 2); // {1=1, 2=2}

        System.out.println(cache.get(1)); // 1 → {2=2, 1=1} (1이 최근으로 이동)
        cache.put(3, 3);                  // capacity 초과 → 가장 오래된 2 제거 → {1=1, 3=3}

        System.out.println(cache.get(2)); // -1 (이미 제거됨)
        System.out.println(cache.get(3)); // 3

        cache.put(4, 4); // 1이 가장 오래됨 → 제거 → {3=3, 4=4}
        System.out.println(cache.get(1)); // -1 (제거됨)
        System.out.println(cache.get(3)); // 3
        System.out.println(cache.get(4)); // 4
    }
}`,
  },
  {
    id: 'lc-007',
    title: '계좌 이체 사이클 감지',
    difficulty: 'hard',
    tags: ['DFS', '그래프', '사이클'],
    description: `카카오페이 계좌 이체 네트워크에서 순환 이체(사이클)를 감지하세요.

이체 내역은 "fromId toId amount" 형식의 문자열 배열입니다.
동일 방향으로 중복된 이체 경로는 무시합니다.

사이클이 존재하면 사이클에 포함된 계좌 ID 목록을 알파벳 순으로 반환하고,
없으면 빈 리스트를 반환하세요.

예: A→B→C→A 이면 [A, B, C] 반환`,
    examples: [
      {
        input: 'transfers = ["A B 1000", "B C 2000", "C A 500", "D E 100"]',
        output: '["A", "B", "C"]',
        explanation: 'A→B→C→A 사이클 존재. D→E는 사이클 없음.',
      },
      {
        input: 'transfers = ["A B 100", "B C 200", "C D 300"]',
        output: '[]',
        explanation: '사이클 없음',
      },
    ],
    constraints: [
      '1 ≤ transfers.length ≤ 10,000',
      '계좌 ID는 알파벳 대문자 1~10자',
      '사이클이 여러 개면 가장 작은 ID가 포함된 사이클 반환',
      '동일 from→to 중복 무시',
    ],
    hint: 'DFS + 방문 상태(WHITE=0, GRAY=1, BLACK=2) 3색 마킹 알고리즘을 사용하세요. GRAY 노드를 다시 만나면 사이클입니다.',
    starterCode: `import java.util.*;

public class Solution {
    private Map<String, List<String>> graph = new HashMap<>();
    private Map<String, Integer> color = new HashMap<>(); // 0=WHITE, 1=GRAY, 2=BLACK
    private List<String> cycle = new ArrayList<>();

    public List<String> detectCycle(String[] transfers) {
        // TODO: 그래프 구성
        for (String t : transfers) {
            String[] parts = t.split(" ");
            // graph에 from→to 엣지 추가
        }

        // TODO: 모든 노드에 대해 DFS 수행
        for (String node : graph.keySet()) {
            if (color.getOrDefault(node, 0) == 0) {
                // dfs(node) 호출
            }
        }

        Collections.sort(cycle);
        return cycle;
    }

    private boolean dfs(String node, List<String> path) {
        // TODO: 3색 DFS 구현
        return false;
    }

    public static void main(String[] args) {
        Solution sol = new Solution();
        String[] t = {"A B 1000", "B C 2000", "C A 500", "D E 100"};
        System.out.println(sol.detectCycle(t)); // [A, B, C]
    }
}`,
    modelSolution: `import java.util.*;

public class Solution {
    private Map<String, List<String>> graph = new HashMap<>();
    private Map<String, Integer> color = new HashMap<>(); // 0=WHITE,1=GRAY,2=BLACK
    private Set<String> cycleNodes = new HashSet<>();

    public List<String> detectCycle(String[] transfers) {
        Set<String> seen = new HashSet<>();
        for (String t : transfers) {
            String[] p = t.split(" ");
            String from = p[0], to = p[1];
            String edge = from + "->" + to;
            if (seen.add(edge)) {
                graph.computeIfAbsent(from, k -> new ArrayList<>()).add(to);
                graph.computeIfAbsent(to, k -> new ArrayList<>()); // ensure node exists
            }
        }

        for (String node : graph.keySet()) {
            if (color.getOrDefault(node, 0) == 0) {
                dfs(node, new ArrayList<>());
            }
        }

        List<String> result = new ArrayList<>(cycleNodes);
        Collections.sort(result);
        return result;
    }

    private void dfs(String node, List<String> path) {
        color.put(node, 1); // GRAY
        path.add(node);

        for (String neighbor : graph.getOrDefault(node, Collections.emptyList())) {
            int neighborColor = color.getOrDefault(neighbor, 0);
            if (neighborColor == 1) {
                int idx = path.indexOf(neighbor);
                cycleNodes.addAll(path.subList(idx, path.size()));
            } else if (neighborColor == 0) {
                dfs(neighbor, path);
            }
        }

        path.remove(path.size() - 1);
        color.put(node, 2); // BLACK
    }
}`,
    annotatedSolution: `import java.util.*;

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 문제: 계좌 이체 사이클 감지
 * 패턴: DFS + 3색 마킹 (방향 그래프 사이클 감지)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 💡 3색 마킹 알고리즘:
 *    WHITE (0): 아직 방문 안 함
 *    GRAY  (1): 현재 DFS 경로에 있음 (재귀 스택에 존재)
 *    BLACK (2): 이 노드에서 시작하는 모든 경로 탐색 완료
 *
 *    → GRAY 노드를 다시 만나면? → 사이클!
 *      (이미 현재 경로에 있는 노드를 또 만남)
 *    → BLACK 노드는 사이클 없다고 확인됨 → 재방문 불필요
 *
 * 💡 왜 단순 visited boolean이 아닌 3색인가?
 *    방향 그래프에서 "이미 탐색 완료(BLACK)"와 "현재 경로 중(GRAY)"을 구분해야
 *    → BLACK 노드 다시 만나도 사이클 아님 (다른 경로에서 이미 탐색 완료)
 *    → GRAY 노드 다시 만나야 사이클
 *
 * 💡 computeIfAbsent: 키가 없으면 새 ArrayList 생성
 *    map.computeIfAbsent(key, k -> new ArrayList<>()).add(value)
 *    = if (!map.containsKey(key)) map.put(key, new ArrayList<>());
 *      map.get(key).add(value);
 *    → 한 줄로 간결하게 처리 (면접관 호감 획득)
 *
 * 시간복잡도: O(V + E) — V=노드수, E=엣지수
 * 공간복잡도: O(V + E) — 그래프 + 재귀 스택
 */
public class Solution {

    // 인접 리스트: from → [to1, to2, ...]
    private Map<String, List<String>> graph = new HashMap<>();

    // 3색 마킹: 0=WHITE(미방문), 1=GRAY(경로중), 2=BLACK(탐색완료)
    private Map<String, Integer> color = new HashMap<>();

    // 사이클에 포함된 노드들 (Set으로 중복 방지)
    private Set<String> cycleNodes = new HashSet<>();

    public List<String> detectCycle(String[] transfers) {
        // Step 1: 그래프 구성 (중복 엣지 제거)
        Set<String> seenEdges = new HashSet<>();
        for (String t : transfers) {
            String[] parts = t.split(" ");
            String from = parts[0]; // 송금자
            String to   = parts[1]; // 수취인
            // amount(parts[2])는 사이클 감지에 불필요 → 무시

            String edgeKey = from + "->" + to; // "A->B"
            if (seenEdges.add(edgeKey)) { // 중복 엣지 무시
                // computeIfAbsent: 없으면 빈 리스트 생성 후 추가
                graph.computeIfAbsent(from, k -> new ArrayList<>()).add(to);
                graph.computeIfAbsent(to,   k -> new ArrayList<>()); // 수취인도 노드로 등록
            }
        }

        // Step 2: 모든 WHITE 노드에서 DFS 시작
        // (연결되지 않은 노드도 탐색해야 함)
        for (String node : graph.keySet()) {
            if (color.getOrDefault(node, 0) == 0) { // WHITE면 탐색
                dfs(node, new ArrayList<>());
            }
        }

        // 결과: 알파벳 순 정렬
        List<String> result = new ArrayList<>(cycleNodes);
        Collections.sort(result);
        return result;
    }

    /**
     * DFS 재귀 탐색
     * @param node  현재 탐색 노드
     * @param path  현재 DFS 경로 (사이클 노드 추출용)
     */
    private void dfs(String node, List<String> path) {
        color.put(node, 1); // GRAY: 현재 경로에 진입
        path.add(node);     // 경로에 추가

        for (String neighbor : graph.getOrDefault(node, Collections.emptyList())) {
            int neighborColor = color.getOrDefault(neighbor, 0);

            if (neighborColor == 1) {
                // GRAY → 사이클 발견!
                // path에서 neighbor 위치부터 현재까지가 사이클 구간
                // 예: path=[A,B,C], neighbor=A → 인덱스 0부터 끝 = [A,B,C]
                int cycleStart = path.indexOf(neighbor);
                cycleNodes.addAll(path.subList(cycleStart, path.size()));

            } else if (neighborColor == 0) {
                // WHITE → 아직 방문 안 함 → 계속 탐색
                dfs(neighbor, path);
            }
            // BLACK → 이미 탐색 완료, 사이클 없음 → 무시
        }

        // 이 노드의 모든 이웃 탐색 완료 → BLACK 마킹
        path.remove(path.size() - 1); // 경로에서 제거 (백트래킹)
        color.put(node, 2); // BLACK: 탐색 완료
    }

    public static void main(String[] args) {
        Solution sol = new Solution();

        // A→B→C→A 사이클
        String[] t1 = {"A B 1000", "B C 2000", "C A 500", "D E 100"};
        System.out.println(sol.detectCycle(t1)); // [A, B, C]

        // 사이클 없음
        sol = new Solution(); // 인스턴스 변수 초기화
        String[] t2 = {"A B 100", "B C 200", "C D 300"};
        System.out.println(sol.detectCycle(t2)); // []
    }
}`,
  },
];
