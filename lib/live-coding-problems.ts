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
  },
  {
    id: 'lc-003',
    title: '괄호 유효성 검사',
    difficulty: 'medium',
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
        input:
          'payments = ["user1,1000,100", "user1,1000,150", "user2,2000,200", "user1,1000,500"]',
        output: '["user1"]',
        explanation:
          'user1이 100초와 150초에 같은 금액 1000원 결제 → 50초 차이로 중복. 500초는 100초 기준 400초 차이라 별도 판단.',
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
        input:
          'transactions = [100, 200, 300, 400, 500, 100], k = 3, threshold = 800',
        output: '[1, 2, 3]',
        explanation:
          '[200,300,400]=900>800, [300,400,500]=1200>800, [400,500,100]=1000>800',
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
        input:
          'transfers = ["A B 1000", "B C 2000", "C A 500", "D E 100"]',
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
                // 사이클 발견: path에서 neighbor부터 현재까지 추출
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
  },
];
